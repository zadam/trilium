import { getLog } from "@triliumnext/core";

import type { AudioCapture, AudioSource } from "./capture";
import { SAMPLE_RATE, type SpeechEngine, type SpeechSegment, type SpeechSegmenter } from "./engine";

/** One transcribed stretch of speech. */
export interface Utterance {
    source: AudioSource;
    /** Milliseconds from the start of the recording to the start of the utterance. */
    offsetMs: number;
    text: string;
}

/** Receives the utterances of a recording in the order they were spoken per source. */
export interface TranscriptSink {
    write(utterance: Utterance): void | Promise<void>;
    /** Called once after the last utterance. */
    close?(): void | Promise<void>;
}

export interface RecordingSessionOptions {
    capture: AudioCapture;
    engine: SpeechEngine;
    sinks: TranscriptSink[];
    now?: () => number;
}

/**
 * One recording: runs each source of `capture` through its own segmenter, so a pause on one source
 * never cuts an utterance on the other, transcribes the utterances one at a time and hands each
 * to every sink.
 */
export class RecordingSession {
    private readonly pipelines = new Map<AudioSource, SourcePipeline>();
    private queue = Promise.resolve();
    private startedAt = 0;

    constructor(private readonly options: RecordingSessionOptions) {}

    async start() {
        this.startedAt = this.now();
        return await this.options.capture.start((source, samples) => {
            // An exception thrown from an `ipcMain` listener takes down the main process.
            try {
                this.pipelineFor(source, samples).accept(samples);
            } catch (e) {
                getLog().error(`Transcription: ${source} failed: ${(e as Error)?.message ?? e}`);
            }
        });
    }

    /** Stops capturing, then waits until the speech already captured has reached every sink. */
    async stop() {
        this.options.capture.stop();
        for (const pipeline of this.pipelines.values()) {
            pipeline.flush();
        }
        await this.queue;

        for (const sink of this.options.sinks) {
            try {
                await sink.close?.();
            } catch (e) {
                getLog().error(`Transcription: closing a sink failed: ${e}`);
            }
        }
    }

    /** Creates a source's pipeline on its first chunk, which was captured before it arrived. */
    private pipelineFor(source: AudioSource, firstChunk: Float32Array) {
        let pipeline = this.pipelines.get(source);
        if (!pipeline) {
            const chunkMs = firstChunk.length / SAMPLE_RATE * 1000;
            pipeline = new SourcePipeline(
                source,
                this.options.engine.createSegmenter(),
                Math.max(0, this.now() - this.startedAt - chunkMs),
                (offsetMs, samples) => this.enqueue(source, offsetMs, samples)
            );
            this.pipelines.set(source, pipeline);
        }
        return pipeline;
    }

    private enqueue(source: AudioSource, offsetMs: number, samples: Float32Array) {
        this.queue = this.queue.then(async () => {
            const text = await this.options.engine.recognizer.transcribe(samples);
            if (!text) {
                return;
            }

            for (const sink of this.options.sinks) {
                try {
                    await sink.write({ source, offsetMs, text });
                } catch (e) {
                    getLog().error(`Transcription: a sink failed: ${e}`);
                }
            }
        }).catch((e) => getLog().error(`Transcription failed: ${e}`));
    }

    private now() {
        return (this.options.now ?? Date.now)();
    }
}

/** Logs every utterance, labeled "Me" for the microphone and "Others" for the system audio. */
export class LogSink implements TranscriptSink {
    constructor(private readonly noteId: string) {}

    write({ source, offsetMs, text }: Utterance) {
        const speaker = source === "microphone" ? "Me" : "Others";
        getLog().info(`Transcription [${formatOffset(offsetMs)}] ${speaker}: ${text}`);
    }

    close() {
        getLog().info(`Transcription: recording for note ${this.noteId} stopped.`);
    }
}

export function formatOffset(milliseconds: number) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Segments one source and logs its peak level every 5 s, to spot a silent source. */
class SourcePipeline {
    private peak = 0;
    private peakSampleCount = 0;

    constructor(
        private readonly source: AudioSource,
        private readonly segmenter: SpeechSegmenter,
        /** Milliseconds from the start of the recording to the source's first sample. */
        private readonly firstSampleOffsetMs: number,
        private readonly onSegment: (offsetMs: number, samples: Float32Array) => void
    ) {}

    accept(samples: Float32Array) {
        this.trackPeak(samples);
        this.emit(this.segmenter.accept(samples));
    }

    flush() {
        this.emit(this.segmenter.flush());
    }

    private emit(segments: SpeechSegment[]) {
        for (const segment of segments) {
            const offsetMs = this.firstSampleOffsetMs + segment.start / SAMPLE_RATE * 1000;
            this.onSegment(offsetMs, segment.samples);
        }
    }

    private trackPeak(samples: Float32Array) {
        for (const sample of samples) {
            this.peak = Math.max(this.peak, Math.abs(sample));
        }
        this.peakSampleCount += samples.length;
        if (this.peakSampleCount >= 5 * SAMPLE_RATE) {
            getLog().info(`Transcription: ${this.source} peak ${this.peak.toFixed(4)} over 5 s`);
            this.peak = 0;
            this.peakSampleCount = 0;
        }
    }
}
