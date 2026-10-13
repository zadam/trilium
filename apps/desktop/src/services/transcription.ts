import { getLog } from "@triliumnext/core";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import { app, BrowserWindow, ipcMain, session } from "electron";
import fs from "fs";
import path from "path";

const SAMPLE_RATE = 16000;
/** Silero VAD consumes 512-sample windows at 16 kHz. */
const VAD_WINDOW_SIZE = 512;
const SAMPLES_CHANNEL = "transcription-poc-samples";
const MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

/**
 * Proof of concept: records the default microphone in a hidden window, splits it into utterances
 * with Silero VAD and logs what Parakeet hears in each. Runs only when
 * `<data dir>/transcription-model` holds `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` plus
 * `silero_vad.onnx`.
 */
export async function startTranscription() {
    const log = getLog();
    if (!fs.existsSync(MODEL_DIR)) {
        log.info(`Transcription: no model in ${MODEL_DIR}, not starting.`);
        return;
    }

    const mod = await import("sherpa-onnx-node");
    const { OfflineRecognizer, Vad } = mod.default ?? mod;
    const recognizer = await OfflineRecognizer.createAsync({
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
    const vad = new Vad({
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

    // Utterances are decoded one at a time so the log keeps their order.
    let decoding = Promise.resolve();
    const transcribe = async (start: number, samples: Float32Array) => {
        const stream = recognizer.createStream();
        stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
        const text = (await recognizer.decodeAsync(stream)).text.trim();
        if (text) {
            log.info(`Transcription [${formatOffset(start)}]: ${text}`);
        }
    };

    const captureWindow = await createCaptureWindow();

    ipcMain.on(SAMPLES_CHANNEL, (event, samples: Float32Array) => {
        if (event.sender !== captureWindow.webContents) {
            return;
        }

        try {
            for (let i = 0; i + VAD_WINDOW_SIZE <= samples.length; i += VAD_WINDOW_SIZE) {
                vad.acceptWaveform(samples.subarray(i, i + VAD_WINDOW_SIZE));
            }

            while (!vad.isEmpty()) {
                const segment = vad.front(false);
                vad.pop();
                decoding = decoding
                    .then(() => transcribe(segment.start, segment.samples))
                    .catch((e) => log.error(`Transcription failed: ${e}`));
            }
        } catch (e) {
            log.error(`Transcription failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    log.info("Transcription: listening to the microphone.");
}

function formatOffset(sampleIndex: number) {
    const seconds = Math.floor(sampleIndex / SAMPLE_RATE);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The window runs only {@link CAPTURE_PAGE}, a local file, so it gets Node integration to reach
 * `ipcRenderer` without a preload. Its in-memory session grants the microphone and nothing else.
 */
async function createCaptureWindow() {
    const captureSession = session.fromPartition("transcription");
    captureSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
    captureSession.setPermissionCheckHandler((_webContents, permission) => permission === "media");

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
    window.webContents.on("console-message", ({ message }) => getLog().info(`Transcription (capture): ${message}`));
    await window.loadFile(pagePath);
    return window;
}

const CAPTURE_PAGE = `<!DOCTYPE html>
<script>
const { ipcRenderer } = require("electron");

navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }).then((media) => {
    const context = new AudioContext({ sampleRate: ${SAMPLE_RATE} });
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => ipcRenderer.send("${SAMPLES_CHANNEL}", e.inputBuffer.getChannelData(0).slice());
    context.createMediaStreamSource(media).connect(processor);
    processor.connect(context.destination);
    console.log("Capturing at " + context.sampleRate + " Hz.");
}).catch((e) => console.error("Microphone unavailable: " + e));
</script>`;
