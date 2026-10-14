import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import fs from "fs";
import path from "path";
import type { Vad } from "sherpa-onnx-node";

/** Every source and engine works on mono 16 kHz samples. */
export const SAMPLE_RATE = 16000;

/** Turns one utterance into text. */
export interface SpeechRecognizer {
    transcribe(samples: Float32Array): Promise<string>;
}

/** A stretch of speech found in a source, `start` counted in samples from the source's start. */
export interface SpeechSegment {
    start: number;
    samples: Float32Array;
}

/** Cuts one source's audio into utterances at its pauses. Each source needs its own. */
export interface SpeechSegmenter {
    /** Takes the next samples and returns the utterances they complete. */
    accept(samples: Float32Array): SpeechSegment[];
    /** Ends the source and returns the utterance still in progress, if any. */
    flush(): SpeechSegment[];
    /** Whether the samples accepted so far end inside an utterance. */
    isSpeaking(): boolean;
}

export interface SpeechEngine {
    recognizer: SpeechRecognizer;
    createSegmenter(): SpeechSegmenter;
}

/** Where the models live: Parakeet TDT 0.6B v3 (int8) plus `silero_vad.onnx`. */
export const MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

/** Silero VAD consumes 512-sample windows at 16 kHz. */
const VAD_WINDOW_SIZE = 512;

/**
 * Loads the local engine: Silero VAD for segmentation and Parakeet for recognition, both through
 * sherpa-onnx. Recognition runs on the libuv thread pool, so it never blocks the main process.
 */
export async function loadSherpaEngine(): Promise<SpeechEngine> {
    if (!fs.existsSync(MODEL_DIR)) {
        throw new ModelMissingError(MODEL_DIR);
    }

    const mod = await import("sherpa-onnx-node");
    const sherpa = mod.default ?? mod;
    const recognizer = await sherpa.OfflineRecognizer.createAsync({
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
        modelConfig: {
            transducer: {
                encoder: path.join(MODEL_DIR, "encoder.int8.onnx"),
                decoder: path.join(MODEL_DIR, "decoder.int8.onnx"),
                joiner: path.join(MODEL_DIR, "joiner.int8.onnx")
            },
            tokens: path.join(MODEL_DIR, "tokens.txt"),
            modelType: "nemo_transducer",
            numThreads: 2,
            provider: "cpu"
        },
        decodingMethod: "greedy_search"
    });

    return {
        recognizer: {
            async transcribe(samples) {
                const stream = recognizer.createStream();
                stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
                return (await recognizer.decodeAsync(stream)).text.trim();
            }
        },
        createSegmenter: () => new VadSegmenter(new sherpa.Vad({
            sileroVad: {
                model: path.join(MODEL_DIR, "silero_vad.onnx"),
                threshold: 0.5,
                minSilenceDuration: 0.5,
                minSpeechDuration: 0.25,
                // Past this length, sherpa ends the segment at the next 0.1 s pause, so
                // continuous speech is committed within about 10 s.
                maxSpeechDuration: 8,
                windowSize: VAD_WINDOW_SIZE
            },
            sampleRate: SAMPLE_RATE,
            numThreads: 1,
            provider: "cpu"
        }, 60))
    };
}

export class ModelMissingError extends Error {
    constructor(readonly directory: string) {
        super(`No speech model in ${directory}`);
    }
}

class VadSegmenter implements SpeechSegmenter {
    constructor(private readonly vad: Vad) {}

    accept(samples: Float32Array) {
        for (let i = 0; i + VAD_WINDOW_SIZE <= samples.length; i += VAD_WINDOW_SIZE) {
            this.vad.acceptWaveform(samples.subarray(i, i + VAD_WINDOW_SIZE));
        }
        return this.drain();
    }

    flush() {
        this.vad.flush();
        return this.drain();
    }

    isSpeaking() {
        return this.vad.isDetected();
    }

    private drain() {
        const segments: SpeechSegment[] = [];
        while (!this.vad.isEmpty()) {
            // Electron's V8 memory cage rejects the external buffers sherpa-onnx uses by default.
            segments.push(this.vad.front(false));
            this.vad.pop();
        }
        return segments;
    }
}
