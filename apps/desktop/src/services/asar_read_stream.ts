import { app } from "electron";
import fs from "fs";
import { sep } from "path";
import { Readable } from "stream";

type CreateReadStream = typeof fs.createReadStream;

/**
 * Makes `fs.createReadStream()` read files inside the app's asar archive with `readFile()`.
 *
 * Electron opens an asar entry through a copy in the OS temp directory, made once per process.
 * macOS deletes temp files that nobody accessed for three days, after which `send` (behind
 * `express.static()` and `res.sendFile()`) fails with `ENOENT`. `readFile()` reads the archive.
 *
 * TODO: Remove this module when upgrading to Electron 45, which reads asar entries in place
 * (electron/electron#52833, fixing electron/electron#52804).
 */
export function setupAsarReadStreams(appPath = app.getAppPath()) {
    if (!appPath.endsWith(".asar")) {
        return;
    }
    fs.createReadStream = wrapCreateReadStream(fs.createReadStream, appPath);
}

/** Wraps `createReadStream` so that paths under `asarPath` are read with `readFile()`. */
export function wrapCreateReadStream(
    createReadStream: CreateReadStream,
    asarPath: string
): CreateReadStream {
    const prefix = asarPath + sep;
    return function (this: unknown, path, options) {
        if (typeof path !== "string" || !path.startsWith(prefix) || !isPlainRange(options)) {
            return createReadStream.call(this, path, options);
        }
        const stream = readFromArchive(path, options?.start ?? 0, options?.end ?? Infinity);
        return stream as fs.ReadStream;
    } as CreateReadStream;
}

type Range = { start?: number; end?: number };

function isPlainRange(options: Parameters<CreateReadStream>[1]): options is Range | undefined {
    return options === undefined
        || (typeof options === "object" && options.fd === undefined && options.encoding == null);
}

/** Streams the bytes from `start` to `end`, both inclusive as in `fs.createReadStream()`. */
function readFromArchive(path: string, start: number, end: number) {
    return Readable.from((async function* () {
        const content = await fs.promises.readFile(path);
        yield content.subarray(start, end + 1);
    })(), { objectMode: false });
}
