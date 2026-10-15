import type { TranscriptionState } from "@triliumnext/commons";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CaptureWindowOptions } from "./capture";
import type { WorkerListeners } from "./worker_client";

const h = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    appListeners: new Map<string, (...args: unknown[]) => unknown>(),
    quit: vi.fn(),
    broadcast: [] as TranscriptionState[],
    notes: new Set<string>([ "meeting" ]),
    isProtected: false,
    isProtectedSessionAvailable: false,
    coreListeners: new Map<string, () => void>(),
    isDev: false,
    installedResources: [] as string[],
    transcriptionModel: null as string | null,
    registerResource: vi.fn(),
    log: { info: vi.fn(), error: vi.fn() },
    listeners: null as WorkerListeners | null,
    captureOptions: null as CaptureWindowOptions | null,
    worker: { start: vi.fn(), connectCapture: vi.fn(), stop: vi.fn(), kill: vi.fn() },
    capture: { start: vi.fn(), stop: vi.fn() },
    sink: { open: vi.fn(), write: vi.fn(), save: vi.fn(), renameSpeaker: vi.fn() }
}));

vi.mock("electron", () => ({
    app: {
        on: (event: string, listener: (...args: unknown[]) => unknown) =>
            h.appListeners.set(event, listener),
        quit: h.quit
    },
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
vi.mock("@triliumnext/core", () => ({
    becca: {
        getNote: (noteId: string) =>
            h.notes.has(noteId) ? { noteId, isProtected: h.isProtected } : null
    },
    events: {
        ENTER_PROTECTED_SESSION: "ENTER_PROTECTED_SESSION",
        subscribe: (event: string, listener: () => void) => h.coreListeners.set(event, listener)
    },
    getLog: () => h.log,
    options: {
        getOptionOrNull: (name: string) => name === "transcriptionModel" ? h.transcriptionModel : null
    },
    protected_session: { isProtectedSessionAvailable: () => h.isProtectedSessionAvailable },
    utils: { isDev: () => h.isDev }
}));
vi.mock("i18next", () => ({
    t: (key: string, options?: object) => options ? `${key} ${JSON.stringify(options)}` : key
}));
vi.mock("@triliumnext/server/src/services/data_dir.js", () => ({
    default: { TRILIUM_DATA_DIR: "/data" }
}));
vi.mock("@triliumnext/server/src/services/resources.js", () => ({
    default: {
        register: h.registerResource,
        getPath: (id: string) => h.installedResources.includes(id) ? `/data/resources/${id}` : null
    }
}));
vi.mock("./capture", () => ({
    CaptureWindow: class {
        start = h.capture.start;
        stop = h.capture.stop;

        constructor(options: CaptureWindowOptions) {
            h.captureOptions = options;
        }
    }
}));
vi.mock("./attachment_sink", () => ({
    AttachmentSink: class {
        open = h.sink.open;
        write = h.sink.write;
        save = h.sink.save;
        renameSpeaker = h.sink.renameSpeaker;
        attachmentId = "transcript1";

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
    h.appListeners.clear();
    h.coreListeners.clear();
    h.isProtected = false;
    h.isProtectedSessionAvailable = false;
    h.broadcast.length = 0;
    h.isDev = false;
    h.transcriptionModel = null;
    h.installedResources = [
        "transcription.parakeet", "transcription.silero-vad", "transcription.titanet"
    ];
    h.listeners = null;
    h.worker.start.mockResolvedValue({ type: "ready", startedAt: STARTED_AT, settings: {} });
    h.capture.start.mockResolvedValue([ "microphone", "system" ]);
    h.worker.stop.mockResolvedValue(undefined);
    h.capture.stop.mockResolvedValue(undefined);
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

    it("stops the engine only once the capture window has posted what it still held", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        let finishCapture = () => {};
        h.capture.stop.mockImplementationOnce(() => new Promise<void>((resolve) => {
            finishCapture = resolve;
        }));

        const stopped = invoke("transcription-stop");
        await Promise.resolve();
        expect(h.capture.stop).toHaveBeenCalledOnce();
        expect(h.worker.stop).not.toHaveBeenCalled();
        finishCapture();
        await stopped;
        expect(h.worker.stop).toHaveBeenCalledOnce();
    });

    it("connects the capture window to the transcription process once that is ready", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");

        expect(h.worker.start).toHaveBeenCalledExactlyOnceWith({
            noteId: "meeting",
            models: {
                recognizer: { directory: "/data/resources/transcription.parakeet", precision: "int8" },
                vad: path.join("/data/resources/transcription.silero-vad", "silero_vad.onnx"),
                speaker: path.join("/data/resources/transcription.titanet", "nemo_en_titanet_small.onnx")
            },
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

    it("says once that a locked protected session holds back the transcript, and saves it on unlocking", async () => {
        h.isProtected = true;
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        h.sink.write.mockImplementation(() => {
            throw new Error("Cannot update content of blob since protected session is not available.");
        });
        const utterance = { source: "system" as const, offsetMs: 0, text: "Hi" };

        h.listeners?.onUtterance(utterance);
        h.listeners?.onUtterance(utterance);
        const errors = h.broadcast.filter((state) => state.error);
        expect(errors).toEqual([ 1, 2 ].map(() => ({
            status: "recording", noteId: "meeting", pendingSources: [],
            error: "transcription.save-locked"
        })));
        expect(await invoke("transcription-get-state")).not.toHaveProperty("error");

        await invoke("transcription-stop");
        h.coreListeners.get("ENTER_PROTECTED_SESSION")?.();
        expect(h.sink.save).toHaveBeenCalledOnce();
        h.coreListeners.get("ENTER_PROTECTED_SESSION")?.();
        expect(h.sink.save).toHaveBeenCalledOnce();
        h.sink.write.mockReset();
    });

    it("says why an unprotected transcript cannot be saved, and retries until a save works", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        h.sink.write.mockImplementationOnce(() => {
            throw new Error("disk full");
        });
        h.listeners?.onUtterance({ source: "system", offsetMs: 0, text: "Hi" });
        expect(h.broadcast.at(-1)?.error)
            .toBe(`transcription.save-failed {"message":"disk full"}`);
        await invoke("transcription-stop");

        h.sink.save.mockImplementationOnce(() => {
            throw new Error("still locked");
        });
        h.coreListeners.get("ENTER_PROTECTED_SESSION")?.();
        expect(h.log.error).toHaveBeenCalledWith(
            "Transcription: saving a transcript still failed: Error: still locked");
        h.coreListeners.get("ENTER_PROTECTED_SESSION")?.();
        h.coreListeners.get("ENTER_PROTECTED_SESSION")?.();
        expect(h.sink.save).toHaveBeenCalledTimes(2);
    });

    it("ignores a lost capture or a dead process once the recording has stopped", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        await invoke("transcription-stop");
        const broadcasts = h.broadcast.length;

        h.captureOptions?.onLost("the capture page ended (killed)");
        h.listeners?.onUnexpectedExit(0);
        await new Promise((resolve) => setTimeout(resolve));
        expect(h.broadcast).toHaveLength(broadcasts);
        expect(h.worker.stop).toHaveBeenCalledOnce();
    });

    it("renames a speaker through the recording that writes the transcript, until it stops", async () => {
        const invoke = await loadService();
        const rename = (attachmentId: unknown, key: unknown, name: unknown) =>
            invoke("transcription-rename-speaker", attachmentId, key, name);
        expect(await rename("transcript1", "system:1", "Alexandra")).toBe(false);

        await invoke("transcription-start", "meeting");
        expect(await rename("transcript1", "system:1", "Alexandra")).toBe(true);
        expect(h.sink.renameSpeaker).toHaveBeenCalledExactlyOnceWith("system:1", "Alexandra");
        // An older transcript of the same note is not the one the recording writes.
        expect(await rename("olderTranscript", "system:1", "Bob")).toBe(false);
        expect(await rename("transcript1", "system:1", 42)).toBe(false);

        let finishStopping = () => {};
        h.worker.stop.mockImplementationOnce(() => new Promise<void>((resolve) => {
            finishStopping = resolve;
        }));
        const stopped = invoke("transcription-stop");
        expect(await rename("transcript1", "microphone", "Elian")).toBe(true);
        finishStopping();
        await stopped;
        expect(await rename("transcript1", "microphone", "Elian")).toBe(false);
        expect(h.sink.renameSpeaker).toHaveBeenCalledTimes(2);
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
        h.installedResources = [ "transcription.parakeet", "transcription.titanet" ];
        expect(await invoke("transcription-start", "meeting"))
            .toBe("transcription.model-not-downloaded");
        expect(h.listeners).toBeNull();
        expect(h.broadcast).toEqual([]);
    });

    it("registers every model, and records without the speaker model", async () => {
        const invoke = await loadService();
        expect(h.registerResource.mock.calls[0].map(({ id }: { id: string }) => id)).toEqual([
            "transcription.parakeet", "transcription.parakeet-fp32", "transcription.silero-vad",
            "transcription.titanet"
        ]);

        h.installedResources = [ "transcription.parakeet", "transcription.silero-vad" ];
        expect(await invoke("transcription-start", "meeting")).toBe("");
        expect(h.worker.start.mock.calls[0][0].models.speaker).toBeNull();
    });

    it("records with the model the option selects, refusing while it is not downloaded", async () => {
        const invoke = await loadService();
        h.transcriptionModel = "parakeet-fp32";
        expect(await invoke("transcription-start", "meeting"))
            .toBe("transcription.model-not-downloaded");

        h.installedResources.push("transcription.parakeet-fp32");
        expect(await invoke("transcription-start", "meeting")).toBe("");
        expect(h.worker.start.mock.calls[0][0].models.recognizer).toEqual({
            directory: "/data/resources/transcription.parakeet-fp32", precision: "fp32"
        });
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

    it("stops a recording whose capture was lost, keeping its queued speech, and says why", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");

        h.captureOptions?.onLost("every audio source ended");
        await vi.waitFor(() => expect(h.broadcast.at(-1))
            .toEqual({ ...IDLE, error: "transcription.capture-lost" }));
        expect(h.capture.stop).toHaveBeenCalledOnce();
        expect(h.worker.stop).toHaveBeenCalledOnce();
        expect(h.worker.kill).not.toHaveBeenCalled();
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
        expect(h.log.error).toHaveBeenCalledWith(
            "Transcription: the capture stopped: every audio source ended.");
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

    it("finishes the transcription before the application quits", async () => {
        const invoke = await loadService();
        const quit = () => {
            const event = { preventDefault: vi.fn() };
            h.appListeners.get("before-quit")?.(event);
            return event;
        };
        expect(quit().preventDefault).not.toHaveBeenCalled();

        await invoke("transcription-start", "meeting");
        let finishStopping = () => {};
        h.worker.stop.mockImplementationOnce(() => new Promise<void>((resolve) => {
            finishStopping = resolve;
        }));
        expect(quit().preventDefault).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(h.worker.stop).toHaveBeenCalledOnce());
        expect(quit().preventDefault).toHaveBeenCalledOnce();
        expect(h.quit).not.toHaveBeenCalled();

        finishStopping();
        await vi.waitFor(() => expect(h.quit).toHaveBeenCalledOnce());
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
        expect(quit().preventDefault).not.toHaveBeenCalled();
    });

    it("quits regardless once the transcription takes too long to finish", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");
        h.worker.stop.mockImplementationOnce(() => new Promise<void>(() => {}));
        vi.useFakeTimers();

        h.appListeners.get("before-quit")?.({ preventDefault: vi.fn() });
        await vi.advanceTimersByTimeAsync(15_000);
        expect(h.quit).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });
});
