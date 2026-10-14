/**
 * The transcription process: an Electron utility process that runs one recording's VAD, speaker
 * embeddings and recognizer, so none of them takes time from the main process. The capture page
 * posts its samples here directly; the main process only receives the utterances. Started by
 * `TranscriptionWorker` in `worker_client.ts`, which also ends it.
 */
import type { TranscriptSource } from "@triliumnext/commons";
import type { MessagePortMain } from "electron";

import { TranscriptFileSink, WavRecorder } from "./audio_recorder";
import { loadSherpaEngine } from "./engine";
import type { CaptureChunk, Logger, WorkerEvent, WorkerRequest } from "./protocol";
import {
    type AudioCapture, type AudioTap, RecordingSession, type SamplesListener, type TranscriptSink
} from "./session";

const log: Logger = {
    info: (message) => post({ type: "log", level: "info", message }),
    error: (message) => post({ type: "log", level: "error", message })
};

type StartRequest = Extract<WorkerRequest, { type: "start" }>;

let session: RecordingSession | null = null;
let capture: PortCapture | null = null;

process.parentPort.on("message", ({ data, ports }) => {
    const request = data as WorkerRequest;
    switch (request.type) {
        case "start":
            start(request).catch((e) => {
                post({ type: "failed", message: (e as Error)?.message ?? String(e) });
            });
            break;
        case "capture":
            if (ports[0]) {
                capture?.connect(ports[0]);
            }
            break;
        case "stop":
            void stop();
            break;
    }
});

async function start({ noteId, modelDirectory, recordingDirectory }: StartRequest) {
    const engine = await loadSherpaEngine(modelDirectory);
    const sinks: TranscriptSink[] = [
        { write: (utterance) => post({ type: "utterance", utterance }) }
    ];
    const taps: AudioTap[] = [];
    if (recordingDirectory) {
        sinks.push(new TranscriptFileSink(recordingDirectory));
        taps.push(new WavRecorder(recordingDirectory, noteId, engine.settings, log));
    }

    capture = new PortCapture();
    const newSession = new RecordingSession({
        capture,
        engine,
        sinks,
        taps,
        log,
        onPendingChanged: (sources) => post({ type: "pending", sources })
    });
    await newSession.start();
    session = newSession;
    post({ type: "ready", startedAt: newSession.startedAt, settings: engine.settings });
}

async function stop() {
    try {
        await session?.stop();
    } catch (e) {
        log.error(`Transcription: stopping failed: ${e}`);
    }
    post({ type: "stopped" });
}

function post(event: WorkerEvent) {
    process.parentPort.postMessage(event);
}

/** The samples the capture page posts to the port the main process connects. */
class PortCapture implements AudioCapture {
    private port: MessagePortMain | null = null;
    private onSamples: SamplesListener | null = null;

    start(onSamples: SamplesListener) {
        this.onSamples = onSamples;
    }

    connect(port: MessagePortMain) {
        this.port = port;
        port.on("message", ({ data }) => {
            const chunk = data as CaptureChunk | null;
            if (chunk && isSource(chunk.source) && chunk.samples instanceof Float32Array) {
                this.onSamples?.(chunk.source, chunk.samples);
            }
        });
        port.start();
    }

    stop() {
        this.onSamples = null;
        this.port?.close();
        this.port = null;
    }
}

function isSource(source: unknown): source is TranscriptSource {
    return source === "microphone" || source === "system";
}
