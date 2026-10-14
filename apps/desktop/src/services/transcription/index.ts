import type { TranscriptionState } from "@triliumnext/commons";
import { becca, getLog, utils as coreUtils } from "@triliumnext/core";
import { BrowserWindow, ipcMain } from "electron";
import { t } from "i18next";

import { AttachmentSink } from "./attachment_sink";
import { RECORDINGS_DIR, WavRecorder } from "./audio_recorder";
import { ElectronAudioCapture } from "./capture";
import { loadSherpaEngine, ModelMissingError } from "./engine";
import { type AudioTap, RecordingSession, type TranscriptSink } from "./session";

const IDLE: TranscriptionState = { status: "idle", noteId: null, pendingSources: [] };

let state = IDLE;
let activeSession: RecordingSession | null = null;

export function setupTranscriptionHandlers() {
    ipcMain.handle("transcription-start", (_event, noteId: unknown) => startRecording(noteId));
    ipcMain.handle("transcription-stop", () => stopRecording());
    ipcMain.handle("transcription-get-state", () => getState());
}

/**
 * Starts recording for the meeting note `noteId`.
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

    setState({ status: "starting", noteId, pendingSources: [] });
    try {
        const session = new RecordingSession({
            capture: new ElectronAudioCapture(),
            engine: await loadSherpaEngine(),
            sinks: createSinks(noteId),
            taps: createTaps(noteId),
            onPendingChanged: (pendingSources) => setState({ ...state, pendingSources })
        });
        const sources = await session.start();
        activeSession = session;
        getLog().info(`Transcription: recording ${sources.join(" and ")} for note ${noteId}.`);
        setState({ ...state, status: "recording" });
        return "";
    } catch (e) {
        setState(IDLE);
        if (e instanceof ModelMissingError) {
            return t("transcription.model-missing", { directory: e.directory });
        }
        getLog().error(`Transcription did not start: ${(e as Error)?.stack ?? e}`);
        return t("transcription.start-failed", { message: (e as Error)?.message ?? String(e) });
    }
}

export async function stopRecording() {
    const session = activeSession;
    if (state.status !== "recording" || !session) {
        return;
    }

    setState({ ...state, status: "stopping" });
    activeSession = null;
    try {
        await session.stop();
        getLog().info(`Transcription: recording for note ${state.noteId} stopped.`);
    } finally {
        setState(IDLE);
    }
}

export function getState() {
    return state;
}

/** Where the utterances of a recording for `noteId` go. */
function createSinks(noteId: string): TranscriptSink[] {
    return [ new AttachmentSink(noteId) ];
}

/**
 * What else receives the audio of a recording for `noteId`: development builds keep it, to
 * transcribe it again while the engine is tuned.
 */
function createTaps(noteId: string): AudioTap[] {
    return coreUtils.isDev() ? [ new WavRecorder(RECORDINGS_DIR, noteId) ] : [];
}

function setState(newState: TranscriptionState) {
    state = newState;
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("transcription-state", state);
    }
}
