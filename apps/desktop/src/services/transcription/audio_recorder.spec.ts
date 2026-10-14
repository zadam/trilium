import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeWavHeader, type RecordingManifest, toPcm16, WavRecorder } from "./audio_recorder";

const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("@triliumnext/core", () => ({ getLog: () => log }));
vi.mock("@triliumnext/server/src/services/data_dir.js", () => ({
    default: { TRILIUM_DATA_DIR: "/data" }
}));

const STARTED_AT = Date.parse("2026-10-14T09:30:00.000Z");

let parentDirectory = "";

beforeEach(() => {
    vi.clearAllMocks();
    parentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "trilium-recordings-"));
});

afterEach(() => {
    fs.rmSync(parentDirectory, { recursive: true, force: true });
});

function readRecording() {
    const [ name ] = fs.readdirSync(parentDirectory);
    const directory = path.join(parentDirectory, name);
    const manifest = JSON.parse(
        fs.readFileSync(path.join(directory, "recording.json"), "utf8")
    ) as RecordingManifest;
    return { name, directory, manifest };
}

describe("WavRecorder", () => {
    it("keeps each source in a WAV file, lined up by the manifest", () => {
        const recorder = new WavRecorder(parentDirectory, "meeting");
        recorder.open(STARTED_AT);
        recorder.write("microphone", new Float32Array([ 0.5, -0.5 ]), 1500);
        recorder.write("system", new Float32Array([ 1 ]), 3000);
        recorder.write("microphone", new Float32Array([ 2, -2 ]), 1500);

        // The header already counts every sample before the recording closes.
        const { name, directory, manifest } = readRecording();
        const microphone = fs.readFileSync(path.join(directory, "microphone.wav"));
        expect(microphone.subarray(0, 44)).toEqual(encodeWavHeader(8));
        expect(microphone.subarray(44)).toEqual(toPcm16(new Float32Array([ 0.5, -0.5, 1, -1 ])));
        recorder.close();

        expect(name).toBe("2026-10-14T09-30-00-000Z_meeting");
        expect(fs.readFileSync(path.join(directory, "system.wav")).length).toBe(46);
        expect(manifest).toEqual({
            noteId: "meeting",
            startedAt: "2026-10-14T09:30:00.000Z",
            sampleRate: 16000,
            sources: {
                microphone: { file: "microphone.wav", firstSampleOffsetMs: 1500 },
                system: { file: "system.wav", firstSampleOffsetMs: 3000 }
            }
        });
    });

    it("stops keeping the audio after a failed write, logging it once", () => {
        const recorder = new WavRecorder(parentDirectory, "meeting");
        recorder.open(STARTED_AT);
        const { directory } = readRecording();
        fs.rmSync(directory, { recursive: true });

        recorder.write("microphone", new Float32Array([ 0.5 ]), 0);
        recorder.write("microphone", new Float32Array([ 0.5 ]), 0);
        recorder.close();

        expect(log.error).toHaveBeenCalledOnce();
        expect(fs.existsSync(directory)).toBe(false);
    });
});

describe("WAV encoding", () => {
    it("describes mono 16-bit PCM at 16 kHz", () => {
        const header = encodeWavHeader(32000);
        expect(header.toString("ascii", 0, 4)).toBe("RIFF");
        expect(header.readUInt32LE(4)).toBe(32036);
        expect(header.toString("ascii", 8, 16)).toBe("WAVEfmt ");
        expect([ header.readUInt16LE(20), header.readUInt16LE(22) ]).toEqual([ 1, 1 ]);
        expect(header.readUInt32LE(24)).toBe(16000);
        expect(header.readUInt32LE(28)).toBe(32000);
        expect([ header.readUInt16LE(32), header.readUInt16LE(34) ]).toEqual([ 2, 16 ]);
        expect(header.toString("ascii", 36, 40)).toBe("data");
        expect(header.readUInt32LE(40)).toBe(32000);
    });

    it("scales samples to the full 16-bit range and clips beyond it", () => {
        const pcm = toPcm16(new Float32Array([ 0, 1, -1, 0.5, 3, -3 ]));
        const values = [ 0, 1, 2, 3, 4, 5 ].map((index) => pcm.readInt16LE(index * 2));
        expect(values).toEqual([ 0, 32767, -32768, 16384, 32767, -32768 ]);
    });
});
