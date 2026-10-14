import fs from "fs";
import path from "path";
import type { SpeakerEmbeddingExtractor, Vad } from "sherpa-onnx-node";

import { SAMPLE_RATE } from "./protocol";
import { SpeakerClusterer, type SpeakerClustererOptions } from "./speakers";

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

/** Tells the speakers of one source apart. Each source needs its own. */
export interface SpeakerTracker {
    /**
     * Returns the speaker of an utterance, numbered from 1 in the order they were first heard, or
     * `null` when the utterance is too short to tell.
     */
    identify(samples: Float32Array): number | null;
}

export interface SpeechEngine {
    recognizer: SpeechRecognizer;
    createSegmenter(): SpeechSegmenter;
    /** Absent when the speaker model is not installed. */
    createSpeakerTracker?(): SpeakerTracker;
    /** The settings that shape the transcript, kept with a recording to compare engines by. */
    settings: Record<string, unknown>;
}

/** The speaker embedding model, optional: without it, utterances carry no speaker. */
const SPEAKER_MODEL = path.join("speaker", "nemo_en_titanet_small.onnx");

/** Silero VAD consumes 512-sample windows at 16 kHz. */
const VAD_WINDOW_SIZE = 512;

const RECOGNIZER_SETTINGS = {
    modelType: "nemo_transducer",
    numThreads: 2,
    provider: "cpu"
};

const DECODING_SETTINGS = {
    decodingMethod: "greedy_search",
    // Makes Parakeet less likely to emit nothing over a stretch of speech, which otherwise drops
    // whole clauses from segments that contain pauses.
    blankPenalty: 0.5
};

const SPEAKER_SETTINGS: SpeakerClustererOptions = {
    threshold: 0.5,
    minDurationSeconds: 1.5
};

const VAD_SETTINGS = {
    threshold: 0.5,
    minSilenceDuration: 0.75,
    minSpeechDuration: 0.25,
    // Past this length, sherpa ends the segment at the next 0.1 s pause, so continuous speech is
    // committed within about 22 s.
    maxSpeechDuration: 20,
    windowSize: VAD_WINDOW_SIZE
};

/**
 * Loads the local engine from `modelDir`: Silero VAD for segmentation (`silero_vad.onnx`) and
 * Parakeet TDT 0.6B v3 int8 for recognition, both through sherpa-onnx. Recognition runs on the
 * libuv thread pool; the VAD and the speaker embeddings run on the calling thread.
 */
export async function loadSherpaEngine(modelDir: string): Promise<SpeechEngine> {
    const speakerModel = path.join(modelDir, SPEAKER_MODEL);
    const mod = await import("sherpa-onnx-node");
    const sherpa = mod.default ?? mod;
    const recognizer = await sherpa.OfflineRecognizer.createAsync({
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
        modelConfig: {
            transducer: {
                encoder: path.join(modelDir, "encoder.int8.onnx"),
                decoder: path.join(modelDir, "decoder.int8.onnx"),
                joiner: path.join(modelDir, "joiner.int8.onnx")
            },
            tokens: path.join(modelDir, "tokens.txt"),
            ...RECOGNIZER_SETTINGS
        },
        ...DECODING_SETTINGS
    });

    const speakerExtractor = fs.existsSync(speakerModel)
        ? new sherpa.SpeakerEmbeddingExtractor({
            model: speakerModel, numThreads: 1, provider: "cpu"
        })
        : null;

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
                model: path.join(modelDir, "silero_vad.onnx"),
                ...VAD_SETTINGS
            },
            sampleRate: SAMPLE_RATE,
            numThreads: 1,
            provider: "cpu"
        }, 60)),
        createSpeakerTracker: speakerExtractor
            ? () => new EmbeddingSpeakerTracker(speakerExtractor, SPEAKER_SETTINGS)
            : undefined,
        settings: {
            modelDirectory: path.resolve(modelDir),
            recognizer: { ...RECOGNIZER_SETTINGS, ...DECODING_SETTINGS },
            vad: VAD_SETTINGS,
            speakers: speakerExtractor
                ? { model: path.basename(speakerModel), ...SPEAKER_SETTINGS }
                : null
        }
    };
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

/**
 * Identifies speakers by clustering TitaNet embeddings. The embedding is computed synchronously,
 * about 100 ms per utterance on one thread.
 */
class EmbeddingSpeakerTracker implements SpeakerTracker {
    private readonly clusterer: SpeakerClusterer;

    constructor(
        private readonly extractor: SpeakerEmbeddingExtractor,
        options: SpeakerClustererOptions
    ) {
        this.clusterer = new SpeakerClusterer(options);
    }

    identify(samples: Float32Array) {
        const stream = this.extractor.createStream();
        stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
        stream.inputFinished();
        if (!this.extractor.isReady(stream)) {
            return null;
        }
        // Electron's V8 memory cage rejects the external buffers sherpa-onnx uses by default.
        const embedding = this.extractor.compute(stream, false);
        return this.clusterer.assign(embedding, samples.length / SAMPLE_RATE);
    }
}
