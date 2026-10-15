import type { ResourceDownloadProgress, ResourceInfo, ResourcesStatusResponse } from "@triliumnext/commons";
import { getLog, utils, ValidationError, ws } from "@triliumnext/core";
import { t } from "i18next";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import dataDirs from "./data_dir.js";

/** One file of a resource, downloaded from `url` and accepted only if it matches `size` and `sha256`. */
export interface ResourceFile {
    /** Where the file goes, relative to the resource's directory; `/` separates directories. */
    path: string;
    url: string;
    size: number;
    /** The SHA-256 of the file, in lowercase hexadecimal. */
    sha256: string;
}

export interface ResourceDefinition {
    /** Lowercase words separated by dots, the feature first: `transcription.model`. */
    id: string;
    /** Part of the resource's directory, so a new version downloads next to the old one. */
    version: string;
    title(): string;
    description(): string;
    /** Boxicons classes, `bx bx-…`, for the download dialog. */
    icon: string;
    files: ResourceFile[];
    /**
     * Returns a directory that holds the files outside the manager, such as a model installed by
     * hand. While it returns one, the resource counts as installed there.
     */
    findLocalCopy?(): string | null;
}

interface Download {
    progress: ResourceDownloadProgress;
    controller: AbortController;
}

const ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const VERSION_PATTERN = /^[\w.-]+$/;
const PROGRESS_INTERVAL_MS = 250;
/** Written into a resource's directory once every file in it is verified. */
const COMPLETE_MARKER = ".complete";

/**
 * Downloads the resources features register into `baseDir`, one directory per resource and
 * version. A file is written under a `.partial` name and renamed once its size and SHA-256 match,
 * so a file under its own name is always verified, and an interrupted download keeps the files it
 * finished.
 */
export class ResourceManager {
    private readonly definitions = new Map<string, ResourceDefinition>();
    private readonly downloads = new Map<string, Download>();

    constructor(
        private readonly baseDir: string,
        private readonly broadcast: (progress: ResourceDownloadProgress) => void
    ) {}

    register(...definitions: ResourceDefinition[]) {
        for (const definition of definitions) {
            validateDefinition(definition);
            if (this.definitions.has(definition.id)) {
                throw new Error(`The resource ${definition.id} is already registered.`);
            }
            this.definitions.set(definition.id, definition);
        }
    }

    /** Returns the directory holding the resource `id`, or `null` while it is not installed. */
    getPath(id: string) {
        const definition = this.getDefinition(id);
        const localCopy = definition.findLocalCopy?.();
        if (localCopy) {
            return localCopy;
        }
        const directory = this.getDirectory(definition);
        return fs.existsSync(path.join(directory, COMPLETE_MARKER)) ? directory : null;
    }

    async getStatus(ids: string[]): Promise<ResourcesStatusResponse> {
        const definitions = ids.map((id) => this.getDefinition(id));
        return {
            resources: definitions.map((definition) => this.getInfo(definition)),
            freeBytes: await this.getFreeBytes(),
            download: this.findDownload(ids)?.progress ?? null
        };
    }

    /**
     * Starts downloading the resources `ids` that are not installed, reporting progress through
     * `broadcast`. Joins a download that already fetches any of them.
     *
     * @returns The download as it starts; `succeeded` already when every resource is installed.
     */
    startDownload(ids: string[]): ResourceDownloadProgress {
        const missing = ids.map((id) => this.getDefinition(id)).filter(({ id }) => !this.getPath(id));
        const running = this.findDownload(ids);
        if (running) {
            return running.progress;
        }

        const download: Download = {
            progress: {
                downloadId: utils.randomString(12),
                resourceIds: ids,
                status: missing.length ? "downloading" : "succeeded",
                receivedBytes: 0,
                totalBytes: sumSizes(missing.flatMap(({ files }) => files)),
                file: null
            },
            controller: new AbortController()
        };
        if (missing.length) {
            this.downloads.set(download.progress.downloadId, download);
            void this.runDownload(download, missing);
        }
        return { ...download.progress };
    }

    cancelDownload(downloadId: string) {
        this.downloads.get(downloadId)?.controller.abort();
    }

    private async runDownload(download: Download, definitions: ResourceDefinition[]) {
        const { progress, controller } = download;
        let lastReported = 0;
        const report = (force: boolean) => {
            if (force || Date.now() - lastReported >= PROGRESS_INTERVAL_MS) {
                lastReported = Date.now();
                this.broadcast({ ...progress });
            }
        };

        try {
            for (const definition of definitions) {
                const directory = this.getDirectory(definition);
                for (const file of definition.files) {
                    const destination = path.join(directory, file.path);
                    if (isDownloaded(destination, file)) {
                        progress.receivedBytes += file.size;
                        continue;
                    }
                    progress.file = path.basename(file.path);
                    report(true);
                    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
                    await downloadFile(file, destination, controller.signal, (bytes) => {
                        progress.receivedBytes += bytes;
                        report(false);
                    });
                }
                await fs.promises.writeFile(path.join(directory, COMPLETE_MARKER), "");
                getLog().info(`Resources: installed ${definition.id} in ${directory}.`);
            }
            progress.status = "succeeded";
        } catch (e) {
            if (controller.signal.aborted) {
                progress.status = "canceled";
            } else {
                progress.status = "failed";
                progress.error = (e as Error)?.message ?? String(e);
                getLog().error(`Resources: downloading ${progress.resourceIds.join(", ")} failed: ${progress.error}`);
            }
        } finally {
            progress.file = null;
            this.downloads.delete(progress.downloadId);
            report(true);
        }
    }

    private getDefinition(id: string) {
        const definition = this.definitions.get(id);
        if (!definition) {
            throw new ValidationError(t("resources.unknown", { id }));
        }
        return definition;
    }

    private getDirectory(definition: ResourceDefinition) {
        return path.join(this.baseDir, definition.id, definition.version);
    }

    private getInfo(definition: ResourceDefinition): ResourceInfo {
        const directory = this.getDirectory(definition);
        const downloaded = definition.files
            .filter((file) => isDownloaded(path.join(directory, file.path), file));
        return {
            id: definition.id,
            title: definition.title(),
            description: definition.description(),
            icon: definition.icon,
            size: sumSizes(definition.files),
            downloadedSize: sumSizes(downloaded),
            sources: [ ...new Set(definition.files.map(({ url }) => new URL(url).hostname)) ],
            installed: this.getPath(definition.id) !== null
        };
    }

    private findDownload(ids: string[]) {
        for (const download of this.downloads.values()) {
            if (download.progress.resourceIds.some((id) => ids.includes(id))) {
                return download;
            }
        }
        return undefined;
    }

    private async getFreeBytes() {
        const directory = fs.existsSync(this.baseDir) ? this.baseDir : path.dirname(this.baseDir);
        try {
            const { bavail, bsize } = await fs.promises.statfs(directory);
            return bavail * bsize;
        } catch {
            return null;
        }
    }
}

/**
 * Downloads `file` to `destination` through `<destination>.partial`, renaming it once its size and
 * SHA-256 match. A failed or aborted download leaves no file behind.
 */
export async function downloadFile(file: ResourceFile, destination: string, signal: AbortSignal,
    onProgress: (bytes: number) => void) {
    const partial = `${destination}.partial`;
    const name = path.basename(file.path);
    try {
        const response = await fetch(file.url, { signal });
        if (!response.ok || !response.body) {
            throw new Error(t("resources.http-error", { name, status: response.status }));
        }

        const hash = createHash("sha256");
        let received = 0;
        const meter = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                received += chunk.length;
                if (received > file.size) {
                    callback(new Error(t("resources.size-mismatch", { name })));
                    return;
                }
                hash.update(chunk);
                onProgress(chunk.length);
                callback(null, chunk);
            }
        });
        const body = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
        await pipeline(body, meter, fs.createWriteStream(partial), { signal });

        if (received !== file.size) {
            throw new Error(t("resources.size-mismatch", { name }));
        }
        if (hash.digest("hex") !== file.sha256) {
            throw new Error(t("resources.hash-mismatch", { name }));
        }
        await fs.promises.rename(partial, destination);
    } catch (e) {
        await fs.promises.rm(partial, { force: true });
        throw e;
    }
}

function validateDefinition({ id, version, files }: ResourceDefinition) {
    if (!ID_PATTERN.test(id) || !VERSION_PATTERN.test(version)) {
        throw new Error(`The resource ${id} has an invalid ID or version.`);
    }
    for (const file of files) {
        const segments = file.path.split("/");
        if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
            throw new Error(`The resource ${id} has a file outside its directory: ${file.path}.`);
        }
    }
}

/** Whether `destination` is a finished download of `file`: only a verified file gets its name. */
function isDownloaded(destination: string, file: ResourceFile) {
    try {
        return fs.statSync(destination).size === file.size;
    } catch {
        return false;
    }
}

function sumSizes(files: ResourceFile[]) {
    return files.reduce((total, { size }) => total + size, 0);
}

export default new ResourceManager(dataDirs.RESOURCES_DIR, (download) => {
    ws.sendMessageToAllClients({ type: "resource-download", download });
});
