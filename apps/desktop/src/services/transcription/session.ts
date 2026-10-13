import type { TranscriptSource, TranscriptUtterance } from "@triliumnext/commons";
import { getLog } from "@triliumnext/core";

import type { AudioCapture } from "./capture";
import { SAMPLE_RATE, type SpeechEngine, type SpeechSegment, type SpeechSegmenter } from "./engine";

/** Receives the utterances of a recording in the order they were spoken per source. */
export interface TranscriptSink {
    /**
     * Called once before capturing starts, with the start time the offsets count from. A sink that
     * throws here keeps the recording from starting.
     */
    open?(startedAt: number): void | Promise<void>;
    write(utterance: TranscriptUtterance): void | Promise<void>;
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
    private readonly pipelines = new Map<TranscriptSource, SourcePipeline>();
    private queue = Promise.resolve();
    private startedAt = 0;

    constructor(private readonly options: RecordingSessionOptions) {}

    async start() {
        this.startedAt = this.now();
        for (const sink of this.options.sinks) {
            await sink.open?.(this.startedAt);
        }
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
    private pipelineFor(source: TranscriptSource, firstChunk: Float32Array) {
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

    private enqueue(source: TranscriptSource, offsetMs: number, samples: Float32Array) {
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

/** Segments one source and logs its peak level every 5 s, to spot a silent source. */
class SourcePipeline {
    private peak = 0;
    private peakSampleCount = 0;

    constructor(
        private readonly source: TranscriptSource,
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
