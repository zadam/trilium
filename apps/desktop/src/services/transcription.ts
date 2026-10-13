import { getLog } from "@triliumnext/core";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import { app, BrowserWindow, ipcMain, session } from "electron";
import fs from "fs";
import path from "path";

const SAMPLE_RATE = 16000;
const SAMPLES_CHANNEL = "transcription-poc-samples";
const MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

/**
 * Proof of concept: records the default microphone in a hidden window and logs what a
 * sherpa-onnx streaming recognizer hears. Runs only when `<data dir>/transcription-model`
 * holds a streaming Zipformer transducer (`sherpa-onnx-streaming-zipformer-en-20M-2023-02-17`).
 */
export async function startTranscription() {
    const log = getLog();
    if (!fs.existsSync(MODEL_DIR)) {
        log.info(`Transcription: no model in ${MODEL_DIR}, not starting.`);
        return;
    }

    const mod = await import("sherpa-onnx-node");
    const { OnlineRecognizer } = mod.default ?? mod;
    const recognizer = new OnlineRecognizer({
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
        modelConfig: {
            transducer: {
                encoder: path.join(MODEL_DIR, "encoder-epoch-99-avg-1.int8.onnx"),
                decoder: path.join(MODEL_DIR, "decoder-epoch-99-avg-1.onnx"),
                joiner: path.join(MODEL_DIR, "joiner-epoch-99-avg-1.int8.onnx")
            },
            tokens: path.join(MODEL_DIR, "tokens.txt"),
            numThreads: 2,
            provider: "cpu"
        },
        decodingMethod: "greedy_search",
        enableEndpoint: true
    });
    const stream = recognizer.createStream();

    const captureWindow = await createCaptureWindow();

    ipcMain.on(SAMPLES_CHANNEL, (event, samples: Float32Array) => {
        if (event.sender !== captureWindow.webContents) {
            return;
        }

        try {
            stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
            while (recognizer.isReady(stream)) {
                recognizer.decode(stream);
            }

            if (recognizer.isEndpoint(stream)) {
                const text = recognizer.getResult(stream).text.trim();
                if (text) {
                    log.info(`Transcription: ${text}`);
                }
                recognizer.reset(stream);
            }
        } catch (e) {
            log.error(`Transcription failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    });

    log.info("Transcription: listening to the microphone.");
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
