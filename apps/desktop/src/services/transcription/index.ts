import type { TranscriptionState, TranscriptUtterance } from "@triliumnext/commons";
import { becca, getLog, utils as coreUtils } from "@triliumnext/core";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import { BrowserWindow, ipcMain, MessageChannelMain } from "electron";
import fs from "fs";
import { t } from "i18next";
import path from "path";

import { AttachmentSink } from "./attachment_sink";
import { CaptureWindow } from "./capture";
import { TranscriptionWorker } from "./worker_client";

/** Where the models live: Parakeet TDT 0.6B v3 (int8) plus `silero_vad.onnx`. */
export const MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

/** Where development builds keep the audio of each recording, one directory per recording. */
export const RECORDINGS_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-recordings");

const IDLE: TranscriptionState = { status: "idle", noteId: null, pendingSources: [] };

interface Recording {
    worker: TranscriptionWorker;
    capture: CaptureWindow;
}

let state = IDLE;
let activeRecording: Recording | null = null;

export function setupTranscriptionHandlers() {
    ipcMain.handle("transcription-start", (_event, noteId: unknown) => startRecording(noteId));
    ipcMain.handle("transcription-stop", () => stopRecording());
    ipcMain.handle("transcription-get-state", () => getState());
}

/**
 * Starts recording for the meeting note `noteId`. The engine runs in a utility process, which
 * the capture window posts its samples to; the main process only stores the utterances.
 *
 * @returns An empty string once recording runs, or the reason it cannot start.
 */
export async function startRecording(noteId: unknown): Promise<string> {
    if (state.status !== "idle") {
        return t("transcription.already-recording");
    }
    if (typeof noteId !== "string" || !becca.getNote(noteId)) {
        return t("transcription.note-not-found");
    }
    if (!fs.existsSync(MODEL_DIR)) {
        return t("transcription.model-missing", { directory: MODEL_DIR });
    }

    setState({ status: "starting", noteId, pendingSources: [] });
    const sink = new AttachmentSink(noteId);
    const recording: Recording = {
        capture: new CaptureWindow(),
        worker: new TranscriptionWorker({
            onUtterance: (utterance) => writeUtterance(sink, utterance),
            onPendingChanged: (pendingSources) => setState({ ...state, pendingSources }),
            onUnexpectedExit: (code) => handleUnexpectedExit(recording, code),
            log: getLog()
        })
    };
    activeRecording = recording;
    try {
        const { startedAt } = await recording.worker.start({
            noteId,
            modelDirectory: MODEL_DIR,
            recordingDirectory: coreUtils.isDev() ? getRecordingDirectory(Date.now(), noteId) : null
        });
        sink.open(startedAt);
        const { port1, port2 } = new MessageChannelMain();
        recording.worker.connectCapture(port2);
        const sources = await recording.capture.start(port1);
        getLog().info(`Transcription: recording ${sources.join(" and ")} for note ${noteId}.`);
        setState({ ...state, status: "recording" });
        return "";
    } catch (e) {
        activeRecording = null;
        recording.capture.stop();
        recording.worker.kill();
        setState(IDLE);
        getLog().error(`Transcription did not start: ${(e as Error)?.stack ?? e}`);
        return t("transcription.start-failed", { message: (e as Error)?.message ?? String(e) });
    }
}

export async function stopRecording() {
    const recording = activeRecording;
    if (state.status !== "recording" || !recording) {
        return;
    }

    setState({ ...state, status: "stopping" });
    activeRecording = null;
    recording.capture.stop();
    try {
        await recording.worker.stop();
        getLog().info(`Transcription: recording for note ${state.noteId} stopped.`);
    } finally {
        setState(IDLE);
    }
}

export function getState() {
    return state;
}

/** The directory under {@link RECORDINGS_DIR} for a recording of `noteId` begun at `createdAt`. */
export function getRecordingDirectory(createdAt: number, noteId: string) {
    const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, "-");
    return path.join(RECORDINGS_DIR, `${timestamp}_${noteId}`);
}

function writeUtterance(sink: AttachmentSink, utterance: TranscriptUtterance) {
    try {
        sink.write(utterance);
    } catch (e) {
        getLog().error(`Transcription: saving an utterance failed: ${e}`);
    }
}

/**
 * Ends a recording whose transcription process died, keeping what was transcribed, and tells
 * every window why it ended.
 */
function handleUnexpectedExit(recording: Recording, code: number) {
    if (activeRecording !== recording) {
        return;
    }
    activeRecording = null;
    recording.capture.stop();
    getLog().error(`Transcription: the transcription process exited with code ${code}.`);
    state = IDLE;
    broadcast({ ...IDLE, error: t("transcription.stopped-unexpectedly") });
}

function setState(newState: TranscriptionState) {
    state = newState;
    broadcast(state);
}

function broadcast(stateToSend: TranscriptionState) {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("transcription-state", stateToSend);
    }
}
