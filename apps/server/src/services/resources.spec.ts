import type { ResourceDownloadProgress } from "@triliumnext/commons";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { type ResourceDefinition, type ResourceFile, ResourceManager } from "./resources.js";

const MODEL = Buffer.alloc(300_000, "m");
const TOKENS = Buffer.from("a\nb\nc\n");

let server: http.Server;
let baseUrl = "";
const requested: string[] = [];
/** The `Range` header of each request, in order. */
const ranges: (string | undefined)[] = [];
/** Makes the next whole-file request for `/model.bin` drop the connection after this many bytes. */
let dropModelAfter: number | null = null;
/** Requests to `/stall`, answered with headers and no body until the test ends. */
let stalled: http.ServerResponse[] = [];

let baseDir = "";
let broadcasts: ResourceDownloadProgress[] = [];
/** The reports of the download {@link waitForEnd} last waited for. */
let reports: ResourceDownloadProgress[] = [];
let manager: ResourceManager;

beforeAll(async () => {
    server = http.createServer((req, res) => {
        requested.push(req.url ?? "");
        ranges.push(req.headers.range);
        if (req.url === "/model.bin") {
            serveModel(req, res);
        } else if (req.url === "/model-no-range.bin") {
            res.end(MODEL);
        } else if (req.url === "/model-wrong-range.bin") {
            res.writeHead(206, { "Content-Range": `bytes 0-${MODEL.length - 1}/${MODEL.length}` });
            res.end(MODEL);
        } else if (req.url === "/tokens.txt") {
            res.end(TOKENS);
        } else if (req.url === "/stall") {
            res.flushHeaders();
            stalled.push(res);
        } else {
            res.statusCode = 404;
            res.end();
        }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "trilium-resources-"));
    broadcasts = [];
    requested.length = 0;
    ranges.length = 0;
    dropModelAfter = null;
    manager = new ResourceManager(baseDir, (progress) => broadcasts.push(progress));
});

afterEach(() => {
    for (const res of stalled) {
        res.destroy();
    }
    stalled = [];
    fs.rmSync(baseDir, { recursive: true, force: true });
});

describe("ResourceManager", () => {
    it("downloads and verifies every file, reporting progress, then serves the directory", async () => {
        manager.register(defineModel());
        expect(manager.getPath("test.model")).toBeNull();

        const started = manager.startDownload([ "test.model" ]);
        expect(started).toMatchObject({
            status: "downloading", receivedBytes: 0, totalBytes: MODEL.length + TOKENS.length
        });
        const finished = await waitForEnd();

        expect(finished).toMatchObject({
            downloadId: started.downloadId,
            status: "succeeded",
            receivedBytes: MODEL.length + TOKENS.length,
            file: null
        });
        expect(reports.some(({ file }) => file === "model.bin")).toBe(true);
        const directory = resourceDirectory();
        expect(path.basename(directory)).toMatch(/^test\.model-[0-9a-f]{12}$/);
        expect(manager.getPath("test.model")).toBe(directory);
        expect(fs.readFileSync(path.join(directory, "nested", "model.bin")).equals(MODEL)).toBe(true);
        expect(fs.readdirSync(path.join(directory, "nested"))).toEqual([ "model.bin" ]);

        const { resources, download } = await manager.getStatus([ "test.model" ]);
        expect(resources).toEqual([ {
            id: "test.model",
            title: "Test model",
            description: "For tests",
            icon: "bx bx-test-tube",
            license: "MIT",
            size: MODEL.length + TOKENS.length,
            downloadedSize: MODEL.length + TOKENS.length,
            sources: [ "127.0.0.1" ],
            installed: true
        } ]);
        expect(download).toBeNull();
        expect(manager.startDownload([ "test.model" ]).status).toBe("succeeded");
    });

    it("discards a file that fails its checksum and keeps the verified ones for the next try", async () => {
        manager.register(defineModel({ tokensHash: sha256(Buffer.from("tampered")) }));

        manager.startDownload([ "test.model" ]);
        const failed = await waitForEnd();

        expect(failed.status).toBe("failed");
        expect(failed.error).toBeTruthy();
        expect(manager.getPath("test.model")).toBeNull();
        expect(fs.readdirSync(resourceDirectory())).toEqual([ ".verified.json", "nested" ]);
        const [ info ] = (await manager.getStatus([ "test.model" ])).resources;
        expect(info).toMatchObject({ installed: false, downloadedSize: MODEL.length });

        requested.length = 0;
        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).receivedBytes).toBe(MODEL.length + TOKENS.length);
        expect(requested).toEqual([ "/tokens.txt" ]);
    });

    it("fails on an HTTP error or a file of the wrong size", async () => {
        manager.register(
            defineModel({ id: "test.missing", tokensUrl: "/absent" }),
            defineModel({ id: "test.short", tokensSize: TOKENS.length + 1 })
        );

        manager.startDownload([ "test.missing" ]);
        expect((await waitForEnd()).status).toBe("failed");
        manager.startDownload([ "test.short" ]);
        expect((await waitForEnd()).status).toBe("failed");
        expect(manager.getPath("test.missing")).toBeNull();
        expect(manager.getPath("test.short")).toBeNull();
    });

    it("joins a running download, and cancels it without leaving an empty partial file", async () => {
        manager.register(defineModel({ tokensUrl: "/stall" }));

        const first = manager.startDownload([ "test.model" ]);
        await waitFor(() => stalled.length > 0);
        expect(manager.startDownload([ "test.model" ]).downloadId).toBe(first.downloadId);
        expect((await manager.getStatus([ "test.model" ])).download?.downloadId).toBe(first.downloadId);

        manager.cancelDownload(first.downloadId);
        expect((await waitForEnd()).status).toBe("canceled");
        expect(fs.readdirSync(resourceDirectory())).toEqual([ ".verified.json", "nested" ]);
        expect((await manager.getStatus([ "test.model" ])).download).toBeNull();
    });

    it("downloads into a new directory once a file of the resource changes", async () => {
        manager.register(defineModel());
        manager.startDownload([ "test.model" ]);
        await waitForEnd();

        const updated = new ResourceManager(baseDir, (progress) => broadcasts.push(progress));
        updated.register(defineModel({ tokensHash: sha256(Buffer.from("a\nb\nd\n")) }));
        expect(updated.getPath("test.model")).toBeNull();
        expect((await updated.getStatus([ "test.model" ])).resources[0].downloadedSize).toBe(0);
    });

    it("notices a file changed after it was installed, and downloads only that one again", async () => {
        manager.register(defineModel());
        manager.startDownload([ "test.model" ]);
        await waitForEnd();
        const tokens = path.join(resourceDirectory(), "tokens.txt");

        fs.writeFileSync(tokens, "x\ny\nz\n");
        fs.utimesSync(tokens, new Date(2020, 0, 1), new Date(2020, 0, 1));
        expect(manager.getPath("test.model")).toBeNull();
        expect((await manager.getStatus([ "test.model" ])).resources[0].downloadedSize)
            .toBe(MODEL.length);

        requested.length = 0;
        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("succeeded");
        expect(requested).toEqual([ "/tokens.txt" ]);
        expect(fs.readFileSync(tokens).equals(TOKENS)).toBe(true);
    });

    it("adopts files put in place by hand once their hash matches, without downloading them", async () => {
        manager.register(defineModel());
        manager.startDownload([ "test.model" ]);
        await waitForEnd();
        fs.rmSync(path.join(resourceDirectory(), ".verified.json"));
        expect(manager.getPath("test.model")).toBeNull();

        requested.length = 0;
        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("succeeded");
        expect(requested).toEqual([]);
        expect(manager.getPath("test.model")).toBe(resourceDirectory());
    });

    it("resumes a file after the connection drops, asking only for the bytes it is missing", async () => {
        manager.register(defineModel());
        dropModelAfter = 120_000;
        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("failed");

        const partial = path.join(resourceDirectory(), "nested", "model.bin.partial");
        const kept = fs.statSync(partial).size;
        expect(kept).toBeGreaterThan(0);
        expect(kept).toBeLessThanOrEqual(120_000);
        expect((await manager.getStatus([ "test.model" ])).resources[0].downloadedSize).toBe(kept);

        ranges.length = 0;
        manager.startDownload([ "test.model" ]);
        expect(await waitForEnd()).toMatchObject({
            status: "succeeded", receivedBytes: MODEL.length + TOKENS.length
        });
        expect(ranges[0]).toBe(`bytes=${kept}-`);
        expect(fs.readFileSync(path.join(resourceDirectory(), "nested", "model.bin")).equals(MODEL))
            .toBe(true);
    });

    it("starts over when the server sends the whole file instead of the rest", async () => {
        manager.register(defineModel());
        dropModelAfter = 120_000;
        manager.startDownload([ "test.model" ]);
        await waitForEnd();

        const resumed = new ResourceManager(baseDir, (progress) => broadcasts.push(progress));
        resumed.register(defineModel({ modelUrl: "/model-no-range.bin" }));
        ranges.length = 0;
        resumed.startDownload([ "test.model" ]);
        expect(await waitForEnd()).toMatchObject({
            status: "succeeded", receivedBytes: MODEL.length + TOKENS.length
        });
        expect(ranges[0]?.startsWith("bytes=")).toBe(true);
        expect(fs.readFileSync(path.join(resourceDirectory(), "nested", "model.bin")).equals(MODEL))
            .toBe(true);
    });

    it("discards the kept bytes when the server answers with another range than asked", async () => {
        manager.register(defineModel());
        dropModelAfter = 120_000;
        manager.startDownload([ "test.model" ]);
        await waitForEnd();
        const partial = path.join(resourceDirectory(), "nested", "model.bin.partial");
        expect(fs.existsSync(partial)).toBe(true);

        const resumed = new ResourceManager(baseDir, (progress) => broadcasts.push(progress));
        resumed.register(defineModel({ modelUrl: "/model-wrong-range.bin" }));
        resumed.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("failed");
        expect(fs.existsSync(partial)).toBe(false);
    });

    it("discards kept bytes that turn out wrong, and downloads the whole file on the next try", async () => {
        manager.register(defineModel());
        dropModelAfter = 120_000;
        manager.startDownload([ "test.model" ]);
        await waitForEnd();
        const partial = path.join(resourceDirectory(), "nested", "model.bin.partial");
        fs.writeFileSync(partial, Buffer.alloc(fs.statSync(partial).size, "x"));

        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("failed");
        expect(fs.existsSync(partial)).toBe(false);

        ranges.length = 0;
        manager.startDownload([ "test.model" ]);
        expect((await waitForEnd()).status).toBe("succeeded");
        expect(ranges[0]).toBeUndefined();
    });

    it("prefers a local copy, and refuses invalid or unknown resources", () => {
        manager.register({ ...defineModel(), findLocalCopy: () => "/hand/installed" });
        expect(manager.getPath("test.model")).toBe("/hand/installed");

        expect(() => manager.register(defineModel())).toThrow(/already registered/);
        expect(() => manager.register(defineModel({ id: "Test Model" }))).toThrow(/invalid ID/);
        expect(() => manager.register({ ...defineModel({ id: "test.escape" }), files: [ file("../outside", MODEL) ] }))
            .toThrow(/outside its directory/);
        expect(() => manager.getPath("test.unknown")).toThrow();
        expect(() => manager.startDownload([ "test.unknown" ])).toThrow();
    });
});

function defineModel({ id = "test.model", modelUrl = "/model.bin", tokensUrl = "/tokens.txt",
    tokensHash = sha256(TOKENS), tokensSize = TOKENS.length } = {}): ResourceDefinition {
    return {
        id,
        title: () => "Test model",
        description: () => "For tests",
        icon: "bx bx-test-tube",
        license: "MIT",
        files: [
            { ...file("nested/model.bin", MODEL), url: `${baseUrl}${modelUrl}` },
            { path: "tokens.txt", url: `${baseUrl}${tokensUrl}`, size: tokensSize, sha256: tokensHash }
        ]
    };
}

/**
 * Serves the model, from the offset a `Range: bytes=<n>-` header asks for when there is one, or
 * drops the connection after {@link dropModelAfter} bytes once when that is set.
 */
function serveModel(req: http.IncomingMessage, res: http.ServerResponse) {
    const range = req.headers.range;
    if (range?.startsWith("bytes=")) {
        const start = Number(range.slice("bytes=".length, range.indexOf("-")));
        res.writeHead(206, { "Content-Range": `bytes ${start}-${MODEL.length - 1}/${MODEL.length}` });
        res.end(MODEL.subarray(start));
    } else if (dropModelAfter !== null) {
        const length = dropModelAfter;
        dropModelAfter = null;
        res.writeHead(200, { "Content-Length": MODEL.length });
        res.write(MODEL.subarray(0, length), () => setTimeout(() => res.destroy(), 20));
    } else {
        res.end(MODEL);
    }
}

/** The directory the resource `id` was downloaded into: the only one named after it. */
function resourceDirectory(id = "test.model") {
    const directories = fs.readdirSync(baseDir).filter((name) => name.startsWith(`${id}-`));
    expect(directories).toHaveLength(1);
    return path.join(baseDir, directories[0]);
}

function file(filePath: string, content: Buffer): ResourceFile {
    return {
        path: filePath,
        url: `${baseUrl}/${path.basename(filePath)}`,
        size: content.length,
        sha256: sha256(content)
    };
}

function sha256(content: Buffer) {
    return createHash("sha256").update(content).digest("hex");
}

/** Resolves with the last progress report once the download it belongs to has ended. */
async function waitForEnd() {
    await waitFor(() => broadcasts.at(-1)?.status !== "downloading" && broadcasts.length > 0);
    const last = broadcasts.at(-1);
    if (!last) {
        throw new Error("No progress was reported.");
    }
    reports = broadcasts;
    broadcasts = [];
    return last;
}

async function waitFor(condition: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!condition()) {
        if (Date.now() > deadline) {
            throw new Error("Timed out.");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
}
