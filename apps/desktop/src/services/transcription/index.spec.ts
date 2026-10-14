import type { TranscriptionState } from "@triliumnext/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerListeners } from "./worker_client";

const h = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    broadcast: [] as TranscriptionState[],
    notes: new Set<string>([ "meeting" ]),
    isDev: false,
    isModelInstalled: true,
    log: { info: vi.fn(), error: vi.fn() },
    listeners: null as WorkerListeners | null,
    worker: { start: vi.fn(), connectCapture: vi.fn(), stop: vi.fn(), kill: vi.fn() },
    capture: { start: vi.fn(), stop: vi.fn() },
    sink: { open: vi.fn(), write: vi.fn() }
}));

vi.mock("electron", () => ({
    ipcMain: {
        handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
            h.handlers.set(channel, handler)
    },
    BrowserWindow: {
        getAllWindows: () => [ 1, 2 ].map(() => ({
            webContents: {
                send: (channel: string, state: TranscriptionState) => {
                    if (channel === "transcription-state") {
                        h.broadcast.push(state);
                    }
                }
            }
        }))
    },
    MessageChannelMain: class {
        port1 = "capture end";
        port2 = "worker end";
    }
}));
vi.mock("fs", () => ({ default: { existsSync: () => h.isModelInstalled } }));
vi.mock("@triliumnext/core", () => ({
    becca: { getNote: (noteId: string) => h.notes.has(noteId) ? { noteId } : null },
    getLog: () => h.log,
    utils: { isDev: () => h.isDev }
}));
vi.mock("i18next", () => ({
    t: (key: string, options?: object) => options ? `${key} ${JSON.stringify(options)}` : key
}));
vi.mock("@triliumnext/server/src/services/data_dir.js", () => ({
    default: { TRILIUM_DATA_DIR: "/data" }
}));
vi.mock("./capture", () => ({
    CaptureWindow: class {
        start = h.capture.start;
        stop = h.capture.stop;
    }
}));
vi.mock("./attachment_sink", () => ({
    AttachmentSink: class {
        open = h.sink.open;
        write = h.sink.write;

        constructor(readonly noteId: string) {}
    }
}));
vi.mock("./worker_client", () => ({
    TranscriptionWorker: class {
        start = h.worker.start;
        connectCapture = h.worker.connectCapture;
        stop = h.worker.stop;
        kill = h.worker.kill;

        constructor(listeners: WorkerListeners) {
            h.listeners = listeners;
        }
    }
}));

const IDLE: TranscriptionState = { status: "idle", noteId: null, pendingSources: [] };
const STARTED_AT = Date.parse("2026-10-14T09:30:00.000Z");

async function loadService() {
    vi.resetModules();
    const service = await import("./index");
    service.setupTranscriptionHandlers();
    return (channel: string, ...args: unknown[]) => h.handlers.get(channel)?.({}, ...args);
}

beforeEach(() => {
    vi.clearAllMocks();
    h.handlers.clear();
    h.broadcast.length = 0;
    h.isDev = false;
    h.isModelInstalled = true;
    h.listeners = null;
    h.worker.start.mockResolvedValue({ type: "ready", startedAt: STARTED_AT, settings: {} });
    h.capture.start.mockResolvedValue([ "microphone", "system" ]);
});

describe("transcription IPC", () => {
    it("records one meeting at a time and tells every window about each step", async () => {
        const invoke = await loadService();

        expect(await invoke("transcription-start", "meeting")).toBe("");
        expect(await invoke("transcription-start", "meeting"))
            .toBe("transcription.already-recording");
        expect(await invoke("transcription-get-state"))
            .toEqual({ status: "recording", noteId: "meeting", pendingSources: [] });

        await invoke("transcription-stop");
        expect(h.capture.stop.mock.invocationCallOrder[0])
            .toBeLessThan(h.worker.stop.mock.invocationCallOrder[0]);
        expect(h.broadcast.map((state) => state.status)).toEqual([
            "starting", "starting", "recording", "recording",
            "stopping", "stopping", "idle", "idle"
        ]);
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
    });

    it("connects the capture window to the transcription process once that is ready", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");

        expect(h.worker.start).toHaveBeenCalledExactlyOnceWith({
            noteId: "meeting",
            modelDirectory: "/data/transcription-model",
            recordingDirectory: null
        });
        expect(h.sink.open).toHaveBeenCalledExactlyOnceWith(STARTED_AT);
        expect(h.worker.connectCapture).toHaveBeenCalledExactlyOnceWith("worker end");
        expect(h.capture.start).toHaveBeenCalledExactlyOnceWith("capture end");
        expect(h.sink.open.mock.invocationCallOrder[0])
            .toBeLessThan(h.capture.start.mock.invocationCallOrder[0]);
    });

    it("stores the utterances and tells every window which sources are pending", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        const utterance = { source: "system" as const, offsetMs: 0, text: "Hi" };

        h.listeners?.onUtterance(utterance);
        h.sink.write.mockImplementationOnce(() => {
            throw new Error("note deleted");
        });
        h.listeners?.onUtterance(utterance);
        expect(h.sink.write).toHaveBeenCalledTimes(2);
        expect(h.log.error).toHaveBeenCalledWith(
            "Transcription: saving an utterance failed: Error: note deleted");

        h.listeners?.onPendingChanged([ "system" ]);
        expect(h.broadcast.at(-1)).toEqual({
            status: "recording", noteId: "meeting", pendingSources: [ "system" ]
        });
        expect(await invoke("transcription-get-state")).toEqual(h.broadcast.at(-1));

        await invoke("transcription-stop");
        const stopping = h.broadcast.find((state) => state.status === "stopping");
        expect(stopping?.pendingSources).toEqual([ "system" ]);
        expect(h.broadcast.at(-1)).toEqual(IDLE);
    });

    it("keeps the audio and the transcript as produced only in development builds", async () => {
        vi.useFakeTimers({ now: STARTED_AT, toFake: [ "Date" ] });
        const invoke = await loadService();

        await invoke("transcription-start", "meeting");
        expect(h.worker.start.mock.calls[0][0].recordingDirectory).toBeNull();
        await invoke("transcription-stop");

        h.isDev = true;
        await invoke("transcription-start", "meeting");
        expect(h.worker.start.mock.calls[1][0].recordingDirectory)
            .toBe("/data/transcription-recordings/2026-10-14T09-30-00-000Z_meeting");
        vi.useRealTimers();
    });

    it("refuses a missing note or model, without changing state", async () => {
        const invoke = await loadService();

        expect(await invoke("transcription-start", "deleted")).toBe("transcription.note-not-found");
        expect(await invoke("transcription-start", { noteId: "meeting" }))
            .toBe("transcription.note-not-found");
        h.isModelInstalled = false;
        expect(await invoke("transcription-start", "meeting"))
            .toBe(`transcription.model-missing {"directory":"/data/transcription-model"}`);
        expect(h.listeners).toBeNull();
        expect(h.broadcast).toEqual([]);
    });

    it("explains why it could not start, ends the process and returns to idle", async () => {
        const invoke = await loadService();

        h.worker.start.mockRejectedValueOnce(new Error("Protobuf parsing failed"));
        expect(await invoke("transcription-start", "meeting"))
            .toBe(`transcription.start-failed {"message":"Protobuf parsing failed"}`);
        expect(h.capture.start).not.toHaveBeenCalled();

        h.capture.start.mockRejectedValueOnce(new Error("No audio source could be captured."));
        expect(await invoke("transcription-start", "meeting"))
            .toBe(`transcription.start-failed {"message":"No audio source could be captured."}`);

        expect(h.worker.kill).toHaveBeenCalledTimes(2);
        expect(h.capture.stop).toHaveBeenCalledTimes(2);
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
        await invoke("transcription-stop");
        expect(h.worker.stop).not.toHaveBeenCalled();
    });

    it("ends a recording whose transcription process died, and says why once", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");

        h.listeners?.onUnexpectedExit(139);
        expect(h.capture.stop).toHaveBeenCalledOnce();
        expect(h.broadcast.at(-1))
            .toEqual({ ...IDLE, error: "transcription.stopped-unexpectedly" });
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
        expect(h.log.error).toHaveBeenCalledWith(
            "Transcription: the transcription process exited with code 139.");

        await invoke("transcription-stop");
        expect(h.worker.stop).not.toHaveBeenCalled();
        expect(await invoke("transcription-start", "meeting")).toBe("");
    });
});
