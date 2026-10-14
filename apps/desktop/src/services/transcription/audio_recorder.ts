import type { TranscriptSource } from "@triliumnext/commons";
import { getLog } from "@triliumnext/core";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import fs from "fs";
import path from "path";

import { SAMPLE_RATE } from "./engine";
import type { AudioTap } from "./session";

/** Where development builds keep the audio of each recording, one directory per recording. */
export const RECORDINGS_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-recordings");

/** The `recording.json` next to the audio files, which lines the sources up with the transcript. */
export interface RecordingManifest {
    noteId: string;
    /** When the recording started, as an ISO 8601 timestamp, like the transcript's `startedAt`. */
    startedAt: string;
    sampleRate: number;
    sources: Partial<Record<TranscriptSource, {
        file: string;
        /** Milliseconds from `startedAt` to the file's first sample. */
        firstSampleOffsetMs: number;
    }>>;
}

/**
 * Keeps a recording's audio as one mono 16-bit WAV file per source, plus a `recording.json`
 * manifest, in a directory of its own under `parentDirectory`. Each write also updates the WAV
 * header, so the files stay playable if the application quits mid-recording.
 */
export class WavRecorder implements AudioTap {
    private directory: string | null = null;
    private manifest: RecordingManifest | null = null;
    private readonly files = new Map<TranscriptSource, WavFile>();
    private failed = false;

    constructor(private readonly parentDirectory: string, private readonly noteId: string) {}

    open(startedAt: number) {
        const startedAtIso = new Date(startedAt).toISOString();
        const directory = path.join(
            this.parentDirectory,
            `${startedAtIso.replace(/[:.]/g, "-")}_${this.noteId}`
        );
        fs.mkdirSync(directory, { recursive: true });
        this.directory = directory;
        this.manifest = {
            noteId: this.noteId,
            startedAt: startedAtIso,
            sampleRate: SAMPLE_RATE,
            sources: {}
        };
        this.writeManifest();
        getLog().info(`Transcription: keeping the audio in ${directory}`);
    }

    write(source: TranscriptSource, samples: Float32Array, firstSampleOffsetMs: number) {
        const { directory, manifest } = this;
        if (this.failed || !directory || !manifest) {
            return;
        }

        try {
            let file = this.files.get(source);
            if (!file) {
                const fileName = `${source}.wav`;
                file = new WavFile(path.join(directory, fileName));
                this.files.set(source, file);
                manifest.sources[source] = { file: fileName, firstSampleOffsetMs };
                this.writeManifest();
            }
            file.append(samples);
        } catch (e) {
            // Stops for good, so a full disk logs once rather than on every chunk.
            this.failed = true;
            getLog().error(`Transcription: stopped keeping the audio: ${e}`);
        }
    }

    close() {
        for (const file of this.files.values()) {
            file.close();
        }
        this.files.clear();
    }

    private writeManifest() {
        if (this.directory && this.manifest) {
            const manifestPath = path.join(this.directory, "recording.json");
            fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
        }
    }
}

const WAV_HEADER_SIZE = 44;
const BYTES_PER_SAMPLE = 2;

/** A mono 16-bit PCM WAV file at {@link SAMPLE_RATE}, written as samples arrive. */
class WavFile {
    private readonly fd: number;
    private dataSize = 0;

    constructor(filePath: string) {
        this.fd = fs.openSync(filePath, "w");
        fs.writeSync(this.fd, encodeWavHeader(0));
    }

    append(samples: Float32Array) {
        const pcm = toPcm16(samples);
        fs.writeSync(this.fd, pcm, 0, pcm.length, WAV_HEADER_SIZE + this.dataSize);
        this.dataSize += pcm.length;
        fs.writeSync(this.fd, encodeWavHeader(this.dataSize), 0, WAV_HEADER_SIZE, 0);
    }

    close() {
        fs.closeSync(this.fd);
    }
}

/** The 44-byte header of a mono 16-bit PCM WAV file whose samples take `dataSize` bytes. */
export function encodeWavHeader(dataSize: number) {
    const header = Buffer.alloc(WAV_HEADER_SIZE);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(WAV_HEADER_SIZE - 8 + dataSize, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
    header.writeUInt16LE(BYTES_PER_SAMPLE, 32);
    header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(dataSize, 40);
    return header;
}

/** Converts samples in [-1, 1] to little-endian 16-bit PCM, clipping any beyond that range. */
export function toPcm16(samples: Float32Array) {
    const pcm = Buffer.alloc(samples.length * BYTES_PER_SAMPLE);
    for (const [ index, sample ] of samples.entries()) {
        const clipped = Math.max(-1, Math.min(1, sample));
        pcm.writeInt16LE(Math.round(clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff),
            index * BYTES_PER_SAMPLE);
    }
    return pcm;
}
