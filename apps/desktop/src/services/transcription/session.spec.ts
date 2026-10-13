import type { TranscriptSource, TranscriptUtterance } from "@triliumnext/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SamplesListener } from "./capture";
import type { SpeechSegment } from "./engine";
import { RecordingSession, type TranscriptSink } from "./session";

const log = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("@triliumnext/core", () => ({ getLog: () => log }));
vi.mock("@triliumnext/server/src/services/data_dir.js", () => ({
    default: { TRILIUM_DATA_DIR: "/data" }
}));

/**
 * A chunk the fake segmenter reads as a finished utterance: `id` becomes the transcribed text
 * (`0` transcribes to nothing), `start` the segment's start in samples. One second long.
 */
function utteranceChunk(id: number, start: number) {
    const samples = new Float32Array(16000);
    samples[0] = id;
    samples[1] = start;
    return samples;
}

function createHarness(extraSinks: TranscriptSink[] = []) {
    let clock = 1000;
    let onSamples: SamplesListener = () => {};
    const capture = {
        start: vi.fn(async (listener: SamplesListener) => {
            onSamples = listener;
            return [ "microphone", "system" ] as TranscriptSource[];
        }),
        stop: vi.fn()
    };
    const flushed: SpeechSegment[][] = [];
    const engine = {
        recognizer: {
            transcribe: vi.fn(async (samples: Float32Array) =>
                samples[0] ? `utterance ${samples[0]}` : "")
        },
        createSegmenter: vi.fn(() => {
            const pending = flushed.shift() ?? [];
            return {
                accept: (samples: Float32Array) => [ { start: samples[1], samples } ],
                flush: () => pending
            };
        })
    };
    const written: TranscriptUtterance[] = [];
    const sink = {
        open: vi.fn(),
        write: vi.fn((utterance: TranscriptUtterance) => {
            written.push(utterance);
        }),
        close: vi.fn()
    };
    const sinks = [ ...extraSinks, sink ];
    const session = new RecordingSession({ capture, engine, sinks, now: () => clock });

    return {
        session, capture, engine, sink, written, flushed,
        /** Delivers `samples` from `source` when the clock reads `at`. */
        deliver(source: TranscriptSource, samples: Float32Array, at: number) {
            clock = at;
            onSamples(source, samples);
        }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("RecordingSession", () => {
    it("labels each source's utterances with their offset from the recording start and length", async () => {
        const { session, capture, engine, sink, deliver, written } = createHarness();
        await session.start();
        expect(sink.open).toHaveBeenCalledExactlyOnceWith(1000);
        expect(sink.open.mock.invocationCallOrder[0])
            .toBeLessThan(capture.start.mock.invocationCallOrder[0]);

        // The microphone's first one-second chunk arrives 2 s in, so it began 1 s in.
        deliver("microphone", utteranceChunk(1, 8000), 3000);
        deliver("system", utteranceChunk(2, 0), 5000);
        deliver("microphone", utteranceChunk(0, 32000), 6000);
        await session.stop();

        expect(engine.createSegmenter).toHaveBeenCalledTimes(2);
        expect(written).toEqual([
            { source: "microphone", offsetMs: 1500, durationMs: 1000, text: "utterance 1" },
            { source: "system", offsetMs: 3000, durationMs: 1000, text: "utterance 2" }
        ]);
    });

    it("transcribes what the segmenters still hold before it closes the sinks", async () => {
        const failingSink: TranscriptSink = {
            write: () => {
                throw new Error("disk full");
            },
            close: () => {
                throw new Error("disk full");
            }
        };
        const { session, capture, deliver, sink, flushed } = createHarness([ failingSink ]);
        flushed.push([ { start: 16000, samples: utteranceChunk(3, 0) } ]);
        await session.start();

        deliver("microphone", utteranceChunk(0, 0), 2000);
        await session.stop();

        expect(capture.stop).toHaveBeenCalledOnce();
        expect(sink.write).toHaveBeenCalledExactlyOnceWith({
            source: "microphone", offsetMs: 1000, durationMs: 1000, text: "utterance 3"
        });
        expect(sink.close).toHaveBeenCalledOnce();
        expect(sink.write.mock.invocationCallOrder[0])
            .toBeLessThan(sink.close.mock.invocationCallOrder[0]);
        expect(log.error).toHaveBeenCalledTimes(2);
    });

    it("does not start capturing when a sink cannot open", async () => {
        const { session, capture, sink } = createHarness();
        sink.open.mockImplementationOnce(() => {
            throw new Error("note deleted");
        });

        await expect(session.start()).rejects.toThrow("note deleted");
        expect(capture.start).not.toHaveBeenCalled();
    });

    it("logs a failing source instead of throwing into the IPC listener", async () => {
        const { session, engine, deliver } = createHarness();
        engine.createSegmenter.mockImplementationOnce(() => {
            throw new Error("VAD model missing");
        });
        await session.start();

        expect(() => deliver("system", utteranceChunk(1, 0), 2000)).not.toThrow();
        expect(log.error).toHaveBeenCalledWith("Transcription: system failed: VAD model missing");
    });
});
