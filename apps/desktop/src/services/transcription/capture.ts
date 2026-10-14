import type { TranscriptSource } from "@triliumnext/commons";
import { getLog } from "@triliumnext/core";
import { app, BrowserWindow, ipcMain, type IpcMainEvent, session } from "electron";
import fs from "fs";
import path from "path";

import { SAMPLE_RATE } from "./engine";

export type SamplesListener = (source: TranscriptSource, samples: Float32Array) => void;

/** Produces mono {@link SAMPLE_RATE} samples per source until stopped. */
export interface AudioCapture {
    /**
     * Starts every source it can and returns the ones that run.
     *
     * @throws when no source could start.
     */
    start(onSamples: SamplesListener): Promise<TranscriptSource[]>;
    stop(): void;
}

const SAMPLES_CHANNEL = "transcription-samples";

/** Samples per IPC message. `VadSegmenter` drops what does not fill a 512-sample window. */
const CHUNK_SAMPLES = 4096;

/** The page function that starts each source. */
const SOURCE_STARTERS = [
    [ "microphone", "captureMicrophone()" ],
    [ "system", "captureSystemAudio()" ]
] as const;

type SamplesIpcListener =
    (event: IpcMainEvent, source: TranscriptSource, samples: Float32Array) => void;

/**
 * Captures the default microphone and the system audio output in a hidden window, which streams
 * the samples to the main process over IPC.
 */
export class ElectronAudioCapture implements AudioCapture {
    private window: BrowserWindow | null = null;
    private listener: SamplesIpcListener | null = null;

    async start(onSamples: SamplesListener) {
        const window = await createCaptureWindow();
        this.window = window;
        this.listener = (event, source, samples) => {
            const isSource = source === "microphone" || source === "system";
            if (event.sender === window.webContents && isSource) {
                onSamples(source, samples);
            }
        };
        ipcMain.on(SAMPLES_CHANNEL, this.listener);

        const sources: TranscriptSource[] = [];
        for (const [ source, call ] of SOURCE_STARTERS) {
            try {
                // getDisplayMedia() requires a user gesture, which the hidden window only gets
                // this way.
                const tracks = await window.webContents.executeJavaScript(call, true);
                getLog().info(`Transcription: capturing ${source} from ${tracks}.`);
                sources.push(source);
            } catch (e) {
                const message = (e as Error)?.message ?? e;
                getLog().error(`Transcription: ${source} unavailable: ${message}`);
            }
        }

        if (!sources.length) {
            this.stop();
            throw new Error("No audio source could be captured.");
        }
        return sources;
    }

    stop() {
        if (this.listener) {
            ipcMain.removeListener(SAMPLES_CHANNEL, this.listener);
            this.listener = null;
        }
        if (this.window && !this.window.isDestroyed()) {
            this.window.destroy();
        }
        this.window = null;
    }
}

/**
 * The window runs only {@link CAPTURE_PAGE}, a local file, so it gets Node integration to reach
 * `ipcRenderer` without a preload. Its in-memory session grants the microphone and screen capture
 * and nothing else; every screen capture request gets the window itself plus the system audio.
 */
async function createCaptureWindow() {
    const captureSession = session.fromPartition("transcription");
    const isAllowed = (permission: string) =>
        permission === "media" || permission === "display-capture";
    captureSession.setPermissionRequestHandler((_webContents, permission, callback) =>
        callback(isAllowed(permission)));
    captureSession.setPermissionCheckHandler((_webContents, permission) => isAllowed(permission));
    // Capturing the requesting frame instead of a screen keeps the Wayland screen-cast portal
    // out of the request.
    captureSession.setDisplayMediaRequestHandler((request, callback) => {
        callback({ video: request.frame ?? undefined, audio: "loopback" });
    });

    const pagePath = path.join(app.getPath("temp"), "trilium-transcription.html");
    fs.writeFileSync(pagePath, CAPTURE_PAGE);

    const window = new BrowserWindow({
        show: false,
        webPreferences: {
            session: captureSession,
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            autoplayPolicy: "no-user-gesture-required",
            backgroundThrottling: false,
            // Without hardware acceleration, a hidden window renders no frames, so the
            // self-capture in CAPTURE_PAGE times out waiting for its video source.
            offscreen: true
        }
    });
    window.webContents.on("console-message", ({ message }) =>
        getLog().info(`Transcription (capture): ${message}`));
    await window.loadFile(pagePath);
    return window;
}

/**
 * The audio worklet that collects a source into chunks of `processorOptions.chunkSamples`. It runs
 * on the audio rendering thread, where a busy page cannot delay it and corrupt the start of a
 * chunk. `.claude/skills/working-with-transcription/capture-test.mjs` reads it from this file.
 */
const CAPTURE_PROCESSOR = `
class ChunkCollector extends AudioWorkletProcessor {
    constructor({ processorOptions }) {
        super();
        this.chunkSamples = processorOptions.chunkSamples;
        this.chunk = new Float32Array(this.chunkSamples);
        this.filled = 0;
    }

    process(inputs) {
        const input = inputs[0][0];
        let offset = 0;
        while (input && offset < input.length) {
            const count = Math.min(input.length - offset, this.chunkSamples - this.filled);
            this.chunk.set(input.subarray(offset, offset + count), this.filled);
            this.filled += count;
            offset += count;
            if (this.filled === this.chunkSamples) {
                this.port.postMessage(this.chunk, [ this.chunk.buffer ]);
                this.chunk = new Float32Array(this.chunkSamples);
                this.filled = 0;
            }
        }
        return true;
    }
}
registerProcessor("chunk-collector", ChunkCollector);
`;

const CAPTURE_PAGE = `<!DOCTYPE html>
<script>
const { ipcRenderer } = require("electron");
const context = new AudioContext({ sampleRate: ${SAMPLE_RATE} });
const processorLoaded = context.audioWorklet.addModule(URL.createObjectURL(
    new Blob([ ${JSON.stringify(CAPTURE_PROCESSOR)} ], { type: "text/javascript" })));

async function pipe(source, media) {
    await processorLoaded;
    const collector = new AudioWorkletNode(context, "chunk-collector", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: "explicit",
        processorOptions: { chunkSamples: ${CHUNK_SAMPLES} }
    });
    collector.port.onmessage = (e) => ipcRenderer.send("${SAMPLES_CHANNEL}", source, e.data);
    context.createMediaStreamSource(media).connect(collector);
}

function describe(tracks) {
    return tracks.map((track) => track.label).join(", ");
}

async function captureMicrophone() {
    const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false }
    });
    await pipe("microphone", media);
    return describe(media.getAudioTracks());
}

async function captureSystemAudio() {
    const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).catch((e) => {
        throw new Error(e.name + ": " + e.message);
    });
    for (const track of media.getVideoTracks()) {
        track.stop();
    }
    const audioTracks = media.getAudioTracks();
    if (!audioTracks.length) {
        throw new Error("the screen capture has no audio track");
    }
    for (const track of audioTracks) {
        console.log("System track muted=" + track.muted + " settings="
            + JSON.stringify(track.getSettings()));
    }
    await pipe("system", new MediaStream(audioTracks));
    return describe(audioTracks);
}
</script>`;
