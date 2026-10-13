import { getLog } from "@triliumnext/core";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import { app, BrowserWindow, desktopCapturer, ipcMain, session } from "electron";
import fs from "fs";
import path from "path";
import type { OfflineRecognizer, Vad } from "sherpa-onnx-node";

const SAMPLE_RATE = 16000;
/** Silero VAD consumes 512-sample windows at 16 kHz. */
const VAD_WINDOW_SIZE = 512;
const SAMPLES_CHANNEL = "transcription-poc-samples";
const MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

/** The microphone carries the local speaker; the system output carries everyone else. */
const SOURCE_LABELS = {
    microphone: "Me",
    system: "Others"
} as const;

type AudioSource = keyof typeof SOURCE_LABELS;

/**
 * Proof of concept: records the default microphone and the system audio output in a hidden window,
 * splits each into utterances with its own Silero VAD and logs what Parakeet hears in each,
 * labeled by source. Runs only when `<data dir>/transcription-model` holds
 * `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` plus `silero_vad.onnx`.
 */
export async function startTranscription() {
    const log = getLog();
    if (!fs.existsSync(MODEL_DIR)) {
        log.info(`Transcription: no model in ${MODEL_DIR}, not starting.`);
        return;
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
    const createVad = () => new sherpa.Vad({
        sileroVad: {
            model: path.join(MODEL_DIR, "silero_vad.onnx"),
            threshold: 0.5,
            minSilenceDuration: 0.5,
            minSpeechDuration: 0.25,
            maxSpeechDuration: 20,
            windowSize: VAD_WINDOW_SIZE
        },
        sampleRate: SAMPLE_RATE,
        numThreads: 1,
        provider: "cpu"
    }, 60);

    const startedAt = Date.now();
    const transcriber = new Transcriber(recognizer, startedAt);
    const pipelines = {
        microphone: new SourcePipeline("microphone", createVad(), transcriber),
        system: new SourcePipeline("system", createVad(), transcriber)
    };

    const captureWindow = await createCaptureWindow();

    ipcMain.on(SAMPLES_CHANNEL, (event, source: AudioSource, samples: Float32Array) => {
        if (event.sender !== captureWindow.webContents || !Object.hasOwn(pipelines, source)) {
            return;
        }

        try {
            pipelines[source].accept(samples);
        } catch (e) {
            log.error(`Transcription failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    try {
        // getDisplayMedia() requires a user gesture, which the hidden window can only get this way.
        const tracks = await captureWindow.webContents
            .executeJavaScript("captureSystemAudio()", true);
        log.info(`Transcription: capturing system audio from ${tracks}.`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log.error(`Transcription: system audio unavailable: ${message}`);
    }
}

/** Decodes utterances one at a time, so the log keeps their order. */
class Transcriber {
    private queue = Promise.resolve();

    constructor(
        private readonly recognizer: OfflineRecognizer,
        private readonly startedAt: number
    ) {}

    enqueue(source: AudioSource, capturedAt: number, samples: Float32Array) {
        this.queue = this.queue
            .then(() => this.transcribe(source, capturedAt, samples))
            .catch((e) => getLog().error(`Transcription failed: ${e}`));
    }

    private async transcribe(source: AudioSource, capturedAt: number, samples: Float32Array) {
        const stream = this.recognizer.createStream();
        stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
        const text = (await this.recognizer.decodeAsync(stream)).text.trim();
        if (text) {
            const offset = formatOffset(capturedAt - this.startedAt);
            getLog().info(`Transcription [${offset}] ${SOURCE_LABELS[source]}: ${text}`);
        }
    }
}

/**
 * Runs one source through its own VAD, so speech on one source never splits an utterance on the
 * other.
 */
class SourcePipeline {
    /** Wall-clock time of the source's first sample, which the VAD counts segment starts from. */
    private firstSampleAt: number | null = null;

    constructor(
        private readonly source: AudioSource,
        private readonly vad: Vad,
        private readonly transcriber: Transcriber
    ) {}

    private peak = 0;
    private sampleCount = 0;

    accept(samples: Float32Array) {
        this.firstSampleAt ??= Date.now() - samples.length / SAMPLE_RATE * 1000;

        for (const sample of samples) {
            this.peak = Math.max(this.peak, Math.abs(sample));
        }
        this.sampleCount += samples.length;
        if (this.sampleCount >= 5 * SAMPLE_RATE) {
            getLog().info(`Transcription: ${this.source} peak ${this.peak.toFixed(4)} over 5 s`);
            this.peak = 0;
            this.sampleCount = 0;
        }

        for (let i = 0; i + VAD_WINDOW_SIZE <= samples.length; i += VAD_WINDOW_SIZE) {
            this.vad.acceptWaveform(samples.subarray(i, i + VAD_WINDOW_SIZE));
        }

        while (!this.vad.isEmpty()) {
            const segment = this.vad.front(false);
            this.vad.pop();
            const capturedAt = this.firstSampleAt + segment.start / SAMPLE_RATE * 1000;
            this.transcriber.enqueue(this.source, capturedAt, segment.samples);
        }
    }
}

function formatOffset(milliseconds: number) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The window runs only {@link CAPTURE_PAGE}, a local file, so it gets Node integration to reach
 * `ipcRenderer` without a preload. Its in-memory session grants the microphone and screen capture
 * and nothing else; every screen capture request gets the first screen plus the system audio.
 */
async function createCaptureWindow() {
    const captureSession = session.fromPartition("transcription");
    const isAllowed = (permission: string) =>
        permission === "media" || permission === "display-capture";
    captureSession.setPermissionRequestHandler((_webContents, permission, callback) =>
        callback(isAllowed(permission)));
    captureSession.setPermissionCheckHandler((_webContents, permission) => isAllowed(permission));
    captureSession.setDisplayMediaRequestHandler((_request, callback) => {
        desktopCapturer.getSources({ types: ["screen"] }).then(([screen]) => {
            callback(screen ? { video: screen, audio: "loopback" } : {});
        }).catch((e) => {
            getLog().error(`Transcription: no screen to capture: ${e}`);
            callback({});
        });
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
            autoplayPolicy: "no-user-gesture-required"
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

async function captureSystemAudio() {
    const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
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
    return audioTracks.map((track) => track.label).join(", ");
}

navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }).then((media) => {
    pipe("microphone", media);
    console.log("Capturing the microphone at " + context.sampleRate + " Hz.");
}).catch((e) => console.error("Microphone unavailable: " + e));
</script>`;
