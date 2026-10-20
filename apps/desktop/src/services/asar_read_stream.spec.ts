import fs from "fs";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { text } from "stream/consumers";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getAppPath: () => "/opt/trilium/resources/app" } }));

const { setupAsarReadStreams, wrapCreateReadStream } = await import("./asar_read_stream.js");

const archive = mkdtempSync(join(tmpdir(), "trilium-asar-"));
const file = join(archive, "index.html");
writeFileSync(file, "0123456789");

afterAll(() => rmSync(archive, { recursive: true, force: true }));

describe("wrapCreateReadStream", () => {
    it("reads files under the archive without opening them, within the range", async () => {
        const original = vi.fn(fs.createReadStream);
        const createReadStream = wrapCreateReadStream(original, archive);

        expect(await text(createReadStream(file))).toBe("0123456789");
        expect(await text(createReadStream(file, { start: 2, end: 4 }))).toBe("234");
        expect(await text(createReadStream(file, { start: 7 }))).toBe("789");
        expect(original).not.toHaveBeenCalled();
    });

    it("fails the stream with the read error for a missing entry", async () => {
        const original = vi.fn(fs.createReadStream);
        const createReadStream = wrapCreateReadStream(original, archive);

        const missing = createReadStream(join(archive, "missing.js"));
        await expect(text(missing)).rejects.toMatchObject({ code: "ENOENT" });
        expect(original).not.toHaveBeenCalled();
    });

    it("passes other paths and options through to the original", () => {
        const stream = {} as fs.ReadStream;
        const original = vi.fn(() => stream);
        const createReadStream = wrapCreateReadStream(original, archive);

        expect(createReadStream(`${archive}.unpacked/addon.node`)).toBe(stream);
        expect(createReadStream(file, "utf-8")).toBe(stream);
        expect(createReadStream(file, { encoding: "utf-8" })).toBe(stream);
        expect(createReadStream(Buffer.from(file))).toBe(stream);
        expect(original).toHaveBeenCalledTimes(4);
    });
});

describe("setupAsarReadStreams", () => {
    const original = fs.createReadStream;
    afterEach(() => {
        fs.createReadStream = original;
    });

    it("installs the wrapper only when the app runs from an asar archive", () => {
        setupAsarReadStreams();
        expect(fs.createReadStream).toBe(original);

        setupAsarReadStreams("/opt/trilium/resources/app.asar");
        expect(fs.createReadStream).not.toBe(original);
    });
});
