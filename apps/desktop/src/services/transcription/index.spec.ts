import type { TranscriptionState } from "@triliumnext/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordingSessionOptions } from "./session";

const h = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    broadcast: [] as TranscriptionState[],
    notes: new Set<string>([ "meeting" ]),
    loadEngine: vi.fn(),
    sessionOptions: null as RecordingSessionOptions | null,
    sessionStart: vi.fn(),
    sessionStop: vi.fn()
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
    }
}));
vi.mock("@triliumnext/core", () => ({
    becca: { getNote: (noteId: string) => h.notes.has(noteId) ? { noteId } : null },
    getLog: () => ({ info: vi.fn(), error: vi.fn() }),
    utils: { isDev: () => false }
}));
vi.mock("i18next", () => ({
    t: (key: string, options?: object) => options ? `${key} ${JSON.stringify(options)}` : key
}));
vi.mock("@triliumnext/server/src/services/data_dir.js", () => ({
    default: { TRILIUM_DATA_DIR: "/data" }
}));
vi.mock("./capture", () => ({ ElectronAudioCapture: class {} }));
vi.mock("./engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./engine")>()),
    loadSherpaEngine: h.loadEngine
}));
vi.mock("./attachment_sink", () => ({ AttachmentSink: class {} }));
vi.mock("./session", () => ({
    RecordingSession: class {
        start = h.sessionStart;
        stop = h.sessionStop;

        constructor(options: RecordingSessionOptions) {
            h.sessionOptions = options;
        }
    }
}));

const { ModelMissingError } = await import("./engine");

const IDLE: TranscriptionState = { status: "idle", noteId: null, pendingSources: [] };

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
    h.loadEngine.mockResolvedValue({});
    h.sessionStart.mockResolvedValue([ "microphone", "system" ]);
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
        expect(h.sessionStop).toHaveBeenCalledOnce();
        expect(h.broadcast.map((state) => state.status)).toEqual([
            "starting", "starting", "recording", "recording",
            "stopping", "stopping", "idle", "idle"
        ]);
        expect(await invoke("transcription-get-state")).toEqual(IDLE);
    });

    it("tells every window which sources are pending while it records", async () => {
        const invoke = await loadService();
        await invoke("transcription-start", "meeting");

        h.sessionOptions?.onPendingChanged?.([ "system" ]);
        expect(h.broadcast.at(-1)).toEqual({
            status: "recording", noteId: "meeting", pendingSources: [ "system" ]
        });
        expect(await invoke("transcription-get-state")).toEqual(h.broadcast.at(-1));

        await invoke("transcription-stop");
        const stopping = h.broadcast.find((state) => state.status === "stopping");
        expect(stopping?.pendingSources).toEqual([ "system" ]);
        expect(h.broadcast.at(-1)).toEqual(IDLE);
    });

    it("refuses a note that does not exist, without changing state", async () => {
        const invoke = await loadService();

        expect(await invoke("transcription-start", "deleted")).toBe("transcription.note-not-found");
        expect(await invoke("transcription-start", { noteId: "meeting" }))
            .toBe("transcription.note-not-found");
        expect(h.loadEngine).not.toHaveBeenCalled();
        expect(h.broadcast).toEqual([]);
    });

    it("explains why it could not start and returns to idle", async () => {
        const invoke = await loadService();

        h.loadEngine.mockRejectedValueOnce(new ModelMissingError("/data/transcription-model"));
        expect(await invoke("transcription-start", "meeting"))
            .toBe(`transcription.model-missing {"directory":"/data/transcription-model"}`);

        h.sessionStart.mockRejectedValueOnce(new Error("No audio source could be captured."));
        expect(await invoke("transcription-start", "meeting"))
            .toBe(`transcription.start-failed {"message":"No audio source could be captured."}`);

        expect(await invoke("transcription-get-state")).toEqual(IDLE);
        await invoke("transcription-stop");
        expect(h.sessionStop).not.toHaveBeenCalled();
    });
});
