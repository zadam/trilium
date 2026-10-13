import { getLog } from "@triliumnext/core";
import { app, BrowserWindow, ipcMain, type IpcMainEvent, session } from "electron";
import fs from "fs";
import path from "path";

import { SAMPLE_RATE } from "./engine";

/** The microphone carries the local speaker; the system output carries everyone else. */
export type AudioSource = "microphone" | "system";

export type SamplesListener = (source: AudioSource, samples: Float32Array) => void;

/** Produces mono {@link SAMPLE_RATE} samples per source until stopped. */
export interface AudioCapture {
    /**
     * Starts every source it can and returns the ones that run.
     *
     * @throws when no source could start.
     */
    start(onSamples: SamplesListener): Promise<AudioSource[]>;
    stop(): void;
}

const SAMPLES_CHANNEL = "transcription-samples";

/** The page function that starts each source. */
const SOURCE_STARTERS = [
    [ "microphone", "captureMicrophone()" ],
    [ "system", "captureSystemAudio()" ]
] as const;

type SamplesIpcListener = (event: IpcMainEvent, source: AudioSource, samples: Float32Array) => void;

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

        const sources: AudioSource[] = [];
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

const CAPTURE_PAGE = `<!DOCTYPE html>
<script>
const { ipcRenderer } = require("electron");
const context = new AudioContext({ sampleRate: ${SAMPLE_RATE} });

function pipe(source, media) {
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) =>
        ipcRenderer.send("${SAMPLES_CHANNEL}", source, e.inputBuffer.getChannelData(0).slice());
    context.createMediaStreamSource(media).connect(processor);
    processor.connect(context.destination);
}

function describe(tracks) {
    return tracks.map((track) => track.label).join(", ");
}

async function captureMicrophone() {
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    pipe("microphone", media);
    return describe(media.getAudioTracks());
}

async function captureSystemAudio() {
    const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
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
    pipe("system", new MediaStream(audioTracks));
    return describe(audioTracks);
}
</script>`;
