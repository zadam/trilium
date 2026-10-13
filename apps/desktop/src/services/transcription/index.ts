import type { TranscriptionState } from "@triliumnext/commons";
import { becca, getLog } from "@triliumnext/core";
import { BrowserWindow, ipcMain } from "electron";
import { t } from "i18next";

import { AttachmentSink } from "./attachment_sink";
import { ElectronAudioCapture } from "./capture";
import { loadSherpaEngine, ModelMissingError } from "./engine";
import { RecordingSession, type TranscriptSink } from "./session";

let state: TranscriptionState = { status: "idle", noteId: null };
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

    setState({ status: "starting", noteId });
    try {
        const session = new RecordingSession({
            capture: new ElectronAudioCapture(),
            engine: await loadSherpaEngine(),
            sinks: createSinks(noteId)
        });
        const sources = await session.start();
        activeSession = session;
        getLog().info(`Transcription: recording ${sources.join(" and ")} for note ${noteId}.`);
        setState({ status: "recording", noteId });
        return "";
    } catch (e) {
        setState({ status: "idle", noteId: null });
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

    setState({ status: "stopping", noteId: state.noteId });
    activeSession = null;
    try {
        await session.stop();
        getLog().info(`Transcription: recording for note ${state.noteId} stopped.`);
    } finally {
        setState({ status: "idle", noteId: null });
    }
}

export function getState() {
    return state;
}

/** Where the utterances of a recording for `noteId` go. */
function createSinks(noteId: string): TranscriptSink[] {
    return [ new AttachmentSink(noteId) ];
}

function setState(newState: TranscriptionState) {
    state = newState;
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("transcription-state", state);
    }
}
