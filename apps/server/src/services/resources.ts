import type { ResourceDownloadProgress, ResourceInfo, ResourcesStatusResponse } from "@triliumnext/commons";
import { getLog, utils, ValidationError, ws } from "@triliumnext/core";
import { t } from "i18next";
import { createHash, type Hash } from "node:crypto";
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
    title(): string;
    description(): string;
    /** Boxicons classes, `bx bx-…`, for the download dialog. */
    icon: string;
    /** The SPDX identifier of the license the files are under, such as `CC-BY-4.0`. */
    license: string;
    files: ResourceFile[];
}

interface Download {
    progress: ResourceDownloadProgress;
    controller: AbortController;
}

/** The size and modification time of each verified file of a resource, by its path. */
type VerifiedFiles = Record<string, { size: number; mtimeMs: number }>;

const ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const PROGRESS_INTERVAL_MS = 250;
/** How many hex digits of the files' combined hash a resource's directory name carries. */
const CONTENT_HASH_LENGTH = 12;
/** Holds the {@link VerifiedFiles} of a resource, in its directory. */
const VERIFIED_FILE = ".verified.json";

/**
 * Downloads the resources features register into `baseDir`, one directory per resource named
 * `<id>-<hash>`, the hash covering every file's path and SHA-256: a resource whose files change
 * downloads into a new directory. A file is written under a `.partial` name and renamed once its
 * size and SHA-256 match, then recorded in `.verified.json` with its size and modification time.
 * A file counts as installed only while it still matches that record, so one changed after its
 * download is downloaded again. An interrupted download keeps the files it finished and the
 * `.partial` of the one it was on, which the next download continues.
 */
export class ResourceManager {
    private readonly definitions = new Map<string, ResourceDefinition>();
    private readonly directories = new Map<string, string>();
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
            this.directories.set(definition.id, path.join(this.baseDir,
                `${definition.id}-${getContentHash(definition.files)}`));
        }
    }

    /** Returns the directory holding the resource `id`, or `null` while it is not installed. */
    getPath(id: string) {
        const definition = this.getDefinition(id);
        const directory = this.getDirectory(definition);
        const verified = readVerifiedFiles(directory);
        const isInstalled = definition.files
            .every((file) => isVerified(verified, path.join(directory, file.path), file));
        return isInstalled ? directory : null;
    }

    /** Reports the resources `ids`, or every registered one when `ids` is left out. */
    async getStatus(ids?: string[]): Promise<ResourcesStatusResponse> {
        const definitions = ids
            ? ids.map((id) => this.getDefinition(id))
            : [ ...this.definitions.values() ];
        return {
            resources: definitions.map((definition) => this.getInfo(definition)),
            freeBytes: await this.getFreeBytes(),
            download: this.findDownload(definitions.map(({ id }) => id))?.progress ?? null
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
            return copyProgress(running.progress);
        }

        const download: Download = {
            progress: {
                downloadId: utils.randomString(12),
                resourceIds: ids,
                status: missing.length ? "downloading" : "succeeded",
                receivedBytes: 0,
                totalBytes: sumSizes(missing.flatMap(({ files }) => files)),
                file: null,
                resources: missing.map(({ id, files }) => ({
                    id, receivedBytes: 0, totalBytes: sumSizes(files), done: false
                }))
            },
            controller: new AbortController()
        };
        if (missing.length) {
            this.downloads.set(download.progress.downloadId, download);
            void this.runDownload(download, missing);
        }
        return copyProgress(download.progress);
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
                this.broadcast(copyProgress(progress));
            }
        };

        try {
            for (const [ index, definition ] of definitions.entries()) {
                const state = progress.resources[index];
                const receive = (bytes: number) => {
                    progress.receivedBytes += bytes;
                    state.receivedBytes += bytes;
                };
                const directory = this.getDirectory(definition);
                const verified = readVerifiedFiles(directory);
                for (const file of definition.files) {
                    const destination = path.join(directory, file.path);
                    if (isVerified(verified, destination, file)) {
                        receive(file.size);
                        continue;
                    }
                    progress.file = path.basename(file.path);
                    report(true);
                    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
                    if (await hasContent(destination, file)) {
                        receive(file.size);
                    } else {
                        await downloadFile(file, destination, controller.signal, (bytes) => {
                            receive(bytes);
                            report(false);
                        });
                    }
                    const { size, mtimeMs } = await fs.promises.stat(destination);
                    verified[file.path] = { size, mtimeMs };
                    await writeVerifiedFiles(directory, verified);
                }
                state.done = true;
                report(true);
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
        const directory = this.directories.get(definition.id);
        if (!directory) {
            throw new Error(`The resource ${definition.id} is not registered.`);
        }
        return directory;
    }

    private getInfo(definition: ResourceDefinition): ResourceInfo {
        const directory = this.getDirectory(definition);
        const verified = readVerifiedFiles(directory);
        const downloadedSize = definition.files.reduce((total, file) => {
            const destination = path.join(directory, file.path);
            return total + (isVerified(verified, destination, file)
                ? file.size
                : getPartialSize(destination, file));
        }, 0);
        const installedDirectory = this.getPath(definition.id);
        return {
            id: definition.id,
            title: definition.title(),
            description: definition.description(),
            icon: definition.icon,
            license: definition.license,
            size: sumSizes(definition.files),
            downloadedSize,
            sources: [ ...new Set(definition.files.map(({ url }) => new URL(url).hostname)) ],
            installed: installedDirectory !== null,
            directory: installedDirectory
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
 * SHA-256 match. A `.partial` left by an interrupted download is continued: its bytes are hashed
 * and the rest is asked for with a `Range` header, or the file starts over when the server sends
 * all of it. A failed download keeps its `.partial` while it is shorter than the file, so that the
 * next one continues it; a complete one that fails its hash is deleted.
 */
export async function downloadFile(file: ResourceFile, destination: string, signal: AbortSignal,
    onProgress: (bytes: number) => void) {
    const partial = `${destination}.partial`;
    const name = path.basename(file.path);
    try {
        let hash = createHash("sha256");
        let received = getPartialSize(destination, file);
        if (received) {
            await hashFileInto(partial, hash);
        }
        const response = await fetch(file.url, {
            signal,
            headers: received ? { Range: `bytes=${received}-` } : undefined
        });
        if (!response.ok || !response.body) {
            throw new Error(t("resources.http-error", { name, status: response.status }));
        }
        if (received && response.status === 206) {
            const contentRange = response.headers.get("Content-Range") ?? "";
            if (!contentRange.startsWith(`bytes ${received}-`)) {
                await fs.promises.rm(partial, { force: true });
                throw new Error(t("resources.size-mismatch", { name }));
            }
            onProgress(received);
        } else {
            hash = createHash("sha256");
            received = 0;
        }

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
        const output = fs.createWriteStream(partial, { flags: received ? "a" : "w" });
        await pipeline(body, meter, output, { signal });

        if (received !== file.size) {
            throw new Error(t("resources.size-mismatch", { name }));
        }
        if (hash.digest("hex") !== file.sha256) {
            throw new Error(t("resources.hash-mismatch", { name }));
        }
        await fs.promises.rename(partial, destination);
    } catch (e) {
        if (getPartialSize(destination, file) === 0) {
            await fs.promises.rm(partial, { force: true });
        }
        throw e;
    }
}

function validateDefinition({ id, files }: ResourceDefinition) {
    if (!ID_PATTERN.test(id)) {
        throw new Error(`The resource ${id} has an invalid ID.`);
    }
    for (const file of files) {
        const segments = file.path.split("/");
        if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
            throw new Error(`The resource ${id} has a file outside its directory: ${file.path}.`);
        }
    }
}

/** The start of a SHA-256 over every file's path and hash, which names a resource's directory. */
function getContentHash(files: ResourceFile[]) {
    const hash = createHash("sha256");
    const sorted = [ ...files ].sort((a, b) => a.path.localeCompare(b.path));
    for (const file of sorted) {
        hash.update(`${file.path}\0${file.sha256}\n`);
    }
    return hash.digest("hex").slice(0, CONTENT_HASH_LENGTH);
}

/**
 * The bytes of `file` an interrupted download kept in `<destination>.partial`, or 0 when there is
 * none or it is already longer than the file can be.
 */
function getPartialSize(destination: string, file: ResourceFile) {
    try {
        const { size } = fs.statSync(`${destination}.partial`);
        return size < file.size ? size : 0;
    } catch {
        return 0;
    }
}

async function hashFileInto(filePath: string, hash: Hash) {
    for await (const chunk of fs.createReadStream(filePath)) {
        hash.update(chunk);
    }
}

function readVerifiedFiles(directory: string): VerifiedFiles {
    try {
        return JSON.parse(fs.readFileSync(path.join(directory, VERIFIED_FILE), "utf8"));
    } catch {
        return {};
    }
}

/** Writes `verified` through a temporary file, so an interruption never leaves a torn record. */
async function writeVerifiedFiles(directory: string, verified: VerifiedFiles) {
    const destination = path.join(directory, VERIFIED_FILE);
    await fs.promises.writeFile(`${destination}.partial`, JSON.stringify(verified));
    await fs.promises.rename(`${destination}.partial`, destination);
}

/** Whether `destination` is `file` as it was verified: same size and modification time. */
function isVerified(verified: VerifiedFiles, destination: string, file: ResourceFile) {
    const record = verified[file.path];
    if (!record || record.size !== file.size) {
        return false;
    }
    try {
        const { size, mtimeMs } = fs.statSync(destination);
        return size === record.size && mtimeMs === record.mtimeMs;
    } catch {
        return false;
    }
}

/** Whether `destination` already holds `file`, as one put there by hand: checked by its hash. */
async function hasContent(destination: string, file: ResourceFile) {
    try {
        if ((await fs.promises.stat(destination)).size !== file.size) {
            return false;
        }
    } catch {
        return false;
    }
    const hash = createHash("sha256");
    await hashFileInto(destination, hash);
    return hash.digest("hex") === file.sha256;
}

/** A snapshot of `progress`, which the running download goes on changing. */
function copyProgress(progress: ResourceDownloadProgress): ResourceDownloadProgress {
    return { ...progress, resources: progress.resources.map((state) => ({ ...state })) };
}

function sumSizes(files: ResourceFile[]) {
    return files.reduce((total, { size }) => total + size, 0);
}

export default new ResourceManager(dataDirs.RESOURCES_DIR, (download) => {
    ws.sendMessageToAllClients({ type: "resource-download", download });
});
