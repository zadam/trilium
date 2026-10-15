import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSherpaEngine } from "./engine";

const h = vi.hoisted(() => ({
    /** Base names of the optional model files the model directory holds. */
    installed: [] as string[],
    recognizerConfig: null as Record<string, unknown> | null,
    vadConfig: null as Record<string, unknown> | null,
    extractorConfig: null as Record<string, unknown> | null,
    decoded: [] as Float32Array[],
    isEmbeddingReady: true,
    embeddings: [] as number[][]
}));

/** Silero as the segmenter sees it: windows in, then whatever segments the spec queues. */
class FakeVad {
    windows: number[] = [];
    queued: { start: number; samples: Float32Array }[] = [];
    pendingAtFlush: { start: number; samples: Float32Array }[] = [];
    isSpeech = false;
    externalBuffers: boolean[] = [];

    constructor(config: Record<string, unknown>) {
        h.vadConfig = config;
        vads.push(this);
    }

    acceptWaveform(window: Float32Array) {
        this.windows.push(window.length);
    }
    flush() {
        this.queued.push(...this.pendingAtFlush);
    }
    isDetected() {
        return this.isSpeech;
    }
    isEmpty() {
        return !this.queued.length;
    }
    front(enableExternalBuffer: boolean) {
        this.externalBuffers.push(enableExternalBuffer);
        return this.queued[0];
    }
    pop() {
        this.queued.shift();
    }
}
const vads: FakeVad[] = [];

vi.mock("sherpa-onnx-node", () => ({
    default: {
        OfflineRecognizer: {
            createAsync: async (config: Record<string, unknown>) => {
                h.recognizerConfig = config;
                return {
                    createStream: () => ({
                        samples: null as Float32Array | null,
                        acceptWaveform(input: { samples: Float32Array }) {
                            this.samples = input.samples;
                        }
                    }),
                    decodeAsync: async (stream: { samples: Float32Array }) => {
                        h.decoded.push(stream.samples);
                        return { text: "  Hello there.  " };
                    }
                };
            }
        },
        Vad: FakeVad,
        SpeakerEmbeddingExtractor: class {
            constructor(config: Record<string, unknown>) {
                h.extractorConfig = config;
            }
            createStream() {
                return { acceptWaveform: vi.fn(), inputFinished: vi.fn() };
            }
            isReady() {
                return h.isEmbeddingReady;
            }
            compute(_stream: unknown, enableExternalBuffer: boolean) {
                expect(enableExternalBuffer).toBe(false);
                return Float32Array.from(h.embeddings.shift() ?? []);
            }
        }
    }
}));
vi.mock("fs", () => ({
    default: { existsSync: (file: string) => h.installed.includes(path.basename(file)) }
}));

const MODEL_DIR = "/models/parakeet";
const MODELS = {
    recognizer: MODEL_DIR,
    vad: "/models/silero/silero_vad.onnx",
    speaker: "/models/titanet/nemo_en_titanet_small.onnx"
};

beforeEach(() => {
    h.installed = [];
    h.isEmbeddingReady = true;
    h.decoded.length = 0;
    h.embeddings.length = 0;
    vads.length = 0;
});

describe("loadSherpaEngine", () => {
    it("loads Parakeet and Silero from their paths and reports their settings", async () => {
        const engine = await loadSherpaEngine(MODELS);

        expect(h.recognizerConfig).toMatchObject({
            featConfig: { sampleRate: 16000, featureDim: 80 },
            modelConfig: {
                transducer: {
                    encoder: path.join(MODEL_DIR, "encoder.int8.onnx"),
                    decoder: path.join(MODEL_DIR, "decoder.int8.onnx"),
                    joiner: path.join(MODEL_DIR, "joiner.int8.onnx")
                },
                tokens: path.join(MODEL_DIR, "tokens.txt"),
                modelType: "nemo_transducer"
            },
            decodingMethod: "greedy_search",
            blankPenalty: 0.5
        });
        expect(engine.createSpeakerTracker).toBeUndefined();
        expect(engine.settings).toMatchObject({
            modelDirectory: path.resolve(MODEL_DIR),
            precision: "int8",
            recognizer: { modelType: "nemo_transducer", blankPenalty: 0.5 },
            vad: { minSilenceDuration: 0.75, maxSpeechDuration: 20, windowSize: 512 },
            speakers: null
        });

        const samples = new Float32Array(1600);
        expect(await engine.recognizer.transcribe(samples)).toBe("Hello there.");
        expect(h.decoded).toEqual([ samples ]);
    });

    it("prefers the full-precision model, decoding it without a blank penalty", async () => {
        h.installed = [ "encoder.onnx" ];
        const engine = await loadSherpaEngine(MODELS);

        expect(h.recognizerConfig).toMatchObject({
            modelConfig: {
                transducer: {
                    encoder: path.join(MODEL_DIR, "encoder.onnx"),
                    decoder: path.join(MODEL_DIR, "decoder.onnx"),
                    joiner: path.join(MODEL_DIR, "joiner.onnx")
                }
            },
            decodingMethod: "greedy_search"
        });
        expect(h.recognizerConfig).not.toHaveProperty("blankPenalty");
        expect(engine.settings).toMatchObject({ precision: "fp32" });
        expect(engine.settings.recognizer).not.toHaveProperty("blankPenalty");
    });

    it("segments a source in whole 512-sample windows, handing out what the VAD completes", async () => {
        const engine = await loadSherpaEngine(MODELS);
        const segmenter = engine.createSegmenter();
        const vad = vads[0];
        expect(h.vadConfig).toMatchObject({
            sileroVad: { model: MODELS.vad, threshold: 0.5 },
            sampleRate: 16000
        });

        const first = { start: 0, samples: new Float32Array(8000) };
        vad.queued.push(first);
        vad.isSpeech = true;
        expect(segmenter.accept(new Float32Array(1100))).toEqual([ first ]);
        expect(vad.windows).toEqual([ 512, 512 ]);
        expect(segmenter.isSpeaking()).toBe(true);

        const last = { start: 16000, samples: new Float32Array(4000) };
        vad.pendingAtFlush.push(last);
        expect(segmenter.accept(new Float32Array(512))).toEqual([]);
        expect(segmenter.flush()).toEqual([ last ]);
        expect(vad.externalBuffers).toEqual([ false, false ]);
    });

    it("tells speakers apart with the speaker model, when it is installed", async () => {
        h.installed = [ "nemo_en_titanet_small.onnx" ];
        const engine = await loadSherpaEngine(MODELS);
        expect(h.extractorConfig?.model).toBe(MODELS.speaker);
        expect(engine.settings.speakers).toMatchObject({
            model: "nemo_en_titanet_small.onnx", threshold: 0.5, minDurationSeconds: 1.5
        });

        const tracker = engine.createSpeakerTracker?.();
        const long = new Float32Array(16000 * 2);
        h.embeddings.push([ 1, 0 ], [ 0, 1 ], [ 0.9, 0.1 ]);
        expect([ 1, 2, 3 ].map(() => tracker?.identify(long))).toEqual([ 1, 2, 1 ]);

        h.isEmbeddingReady = false;
        expect(tracker?.identify(new Float32Array(100))).toBeNull();

        const withoutSpeakers = await loadSherpaEngine({ ...MODELS, speaker: null });
        expect(withoutSpeakers.createSpeakerTracker).toBeUndefined();
        expect(withoutSpeakers.settings.speakers).toBeNull();
    });
});
