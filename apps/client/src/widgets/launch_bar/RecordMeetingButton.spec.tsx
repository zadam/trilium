import type { TranscriptionState } from "@triliumnext/commons";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type FNote from "../../entities/fnote";
import { renderInto } from "../../test/render";

const mocks = vi.hoisted(() => ({
    getInboxNote: vi.fn(),
    createNote: vi.fn(),
    showError: vi.fn(),
    requireResources: vi.fn(),
    transcriptionModel: null as string | null,
    speakersEnabled: true,
    transcriptionEnabled: true
}));

vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useTriliumOptionBool: (name: string) => [
        name === "transcriptionEnabled" && mocks.transcriptionEnabled,
        vi.fn()
    ]
}));

vi.mock("../../services/date_notes", () => ({
    default: { getInboxNote: mocks.getInboxNote }
}));
vi.mock("../../services/note_create", () => ({
    default: { createNote: mocks.createNote }
}));
vi.mock("../../services/dialog", () => ({
    requireResources: mocks.requireResources
}));
vi.mock("../../services/options", () => ({
    default: {
        get: (name: string) => name === "transcriptionModel" ? mocks.transcriptionModel : null,
        is: (name: string) => name === "transcriptionSpeakersEnabled" && mocks.speakersEnabled
    }
}));
vi.mock("../../services/toast", () => ({
    default: { showError: mocks.showError }
}));
vi.mock("../../services/i18n", () => ({
    t: (key: string, options?: { date?: string }) => `${key} ${options?.date}`
}));
vi.mock("./launch_bar_widgets", () => ({
    LaunchBarActionButton: ({ icon, text, disabled, onClick }: {
        icon: string; text: string; disabled?: boolean; onClick: () => void;
    }) => <button className={icon} disabled={disabled} onClick={onClick}>{text}</button>,
    useLauncherIconAndTitle: () => ({ icon: "bx bx-microphone", title: "Record meeting" })
}));

import RecordMeetingButton, { createMeetingNote, toggleRecording } from "./RecordMeetingButton";

beforeEach(() => {
    vi.clearAllMocks();
    mocks.transcriptionModel = null;
    mocks.speakersEnabled = true;
    mocks.transcriptionEnabled = true;
    vi.useFakeTimers({ now: new Date(2026, 9, 13, 14, 30), toFake: [ "Date" ] });
});

describe("createMeetingNote", () => {
    it("creates a labeled text note titled with the date and time in the inbox", async () => {
        mocks.getInboxNote.mockResolvedValue({ noteId: "inbox", isProtected: true });

        await createMeetingNote();

        expect(mocks.createNote).toHaveBeenCalledExactlyOnceWith("inbox", {
            title: "record_meeting.note_title 2026-10-13 14:30",
            type: "text",
            isProtected: true,
            focus: "content",
            attributes: [ { type: "label", name: "meetingRecording", value: "" } ]
        });
    });

    it("creates nothing without an inbox note", async () => {
        mocks.getInboxNote.mockResolvedValue(null);
        vi.spyOn(console, "warn").mockImplementation(() => {});

        await createMeetingNote();

        expect(mocks.createNote).not.toHaveBeenCalled();
    });
});

describe("toggleRecording", () => {
    const transcription = { start: vi.fn(), stop: vi.fn() };

    beforeEach(() => {
        window.electronApi = { transcription } as unknown as typeof window.electronApi;
        mocks.getInboxNote.mockResolvedValue({ noteId: "inbox", isProtected: false });
        mocks.createNote.mockResolvedValue({ note: { noteId: "meeting" } });
        mocks.requireResources.mockResolvedValue(true);
    });

    it("starts recording into a new meeting note, and shows why it could not", async () => {
        transcription.start.mockResolvedValueOnce("");
        await toggleRecording("idle");
        expect(transcription.start).toHaveBeenCalledExactlyOnceWith("meeting");
        expect(mocks.showError).not.toHaveBeenCalled();

        transcription.start.mockResolvedValueOnce("No speech model");
        await toggleRecording("idle");
        expect(mocks.showError).toHaveBeenCalledExactlyOnceWith("No speech model");
        expect(mocks.createNote).toHaveBeenCalledTimes(2);
    });

    it("stops a running recording, and leaves one that is starting or stopping alone", async () => {
        await toggleRecording("recording");
        await toggleRecording("starting");
        await toggleRecording("stopping");

        expect(transcription.stop).toHaveBeenCalledOnce();
        expect(transcription.start).not.toHaveBeenCalled();
        expect(mocks.createNote).not.toHaveBeenCalled();
    });

    it("asks for the model first, and creates no note when it is not downloaded", async () => {
        await toggleRecording("idle");
        expect(mocks.requireResources).toHaveBeenCalledExactlyOnceWith(
            [ "transcription.parakeet", "transcription.silero-vad", "transcription.titanet" ]);
        expect(transcription.start).toHaveBeenCalledOnce();

        mocks.requireResources.mockResolvedValueOnce(false);
        await toggleRecording("idle");
        expect(mocks.createNote).toHaveBeenCalledOnce();
        expect(transcription.start).toHaveBeenCalledOnce();
    });

    it("asks for the model the settings select", async () => {
        mocks.transcriptionModel = "parakeet-fp32";
        await toggleRecording("idle");
        expect(mocks.requireResources).toHaveBeenCalledExactlyOnceWith(
            [ "transcription.parakeet-fp32", "transcription.silero-vad", "transcription.titanet" ]);
    });

    it("leaves the speaker model out while speaker identification is off", async () => {
        mocks.speakersEnabled = false;
        await toggleRecording("idle");
        expect(mocks.requireResources).toHaveBeenCalledExactlyOnceWith(
            [ "transcription.parakeet", "transcription.silero-vad" ]);
    });

    it("starts nothing when no meeting note could be created", async () => {
        mocks.getInboxNote.mockResolvedValue(null);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await toggleRecording("idle");
        expect(transcription.start).not.toHaveBeenCalled();
    });

    it("does nothing outside the desktop app", async () => {
        window.electronApi = undefined;
        await toggleRecording("idle");
        expect(mocks.createNote).not.toHaveBeenCalled();
    });
});

describe("RecordMeetingButton", () => {
    it("shows nothing while transcription is turned off in the settings", () => {
        mocks.transcriptionEnabled = false;
        const container = renderInto(<RecordMeetingButton launcherNote={{} as FNote} />);
        expect(container.querySelector(".record-meeting-launcher")).toBeNull();
        expect(container.querySelector("button")).toBeNull();
    });

    it("marks the launcher as beta", () => {
        const container = renderInto(<RecordMeetingButton launcherNote={{} as FNote} />);
        expect(container.querySelector(".record-meeting-launcher .record-meeting-beta-badge")?.textContent)
            .toContain("common.beta");
    });

    it("says once why a recording stopped by itself", async () => {
        let onStateChanged: (state: TranscriptionState) => void = () => {};
        const report = (state: Partial<TranscriptionState>) => act(() => onStateChanged({
            status: "idle", noteId: null, pendingSources: [], ...state
        }));
        window.electronApi = {
            transcription: {
                getState: async () => ({ status: "idle", noteId: null, pendingSources: [] }),
                onStateChanged: (callback: typeof onStateChanged) => {
                    onStateChanged = callback;
                    return () => {};
                }
            }
        } as unknown as typeof window.electronApi;
        act(() => {
            renderInto(<RecordMeetingButton launcherNote={{} as FNote} />);
        });

        await report({ status: "recording", noteId: "meeting" });
        await report({ error: "Stopped unexpectedly" });
        await report({ error: "Stopped unexpectedly", pendingSources: [] });
        expect(mocks.showError).toHaveBeenCalledExactlyOnceWith("Stopped unexpectedly");

        await report({ status: "recording", noteId: "meeting" });
        await report({ error: "Stopped unexpectedly" });
        expect(mocks.showError).toHaveBeenCalledTimes(2);
        window.electronApi = undefined;
    });

    it("shows the shared recording's state, and starts or stops it on a click", async () => {
        let onStateChanged: (state: TranscriptionState) => void = () => {};
        const report = (status: TranscriptionState["status"]) =>
            act(() => onStateChanged({ status, noteId: "meeting", pendingSources: [] }));
        const transcription = {
            getState: async () => ({ status: "recording", noteId: "meeting", pendingSources: [] }),
            onStateChanged: (callback: typeof onStateChanged) => {
                onStateChanged = callback;
                return () => {};
            },
            stop: vi.fn(async () => {}),
            start: vi.fn(async () => "")
        };
        window.electronApi = { transcription } as unknown as typeof window.electronApi;
        mocks.getInboxNote.mockResolvedValue({ noteId: "inbox", isProtected: false });
        mocks.createNote.mockResolvedValue({ note: { noteId: "meeting" } });
        let container: HTMLElement | null = null;
        act(() => {
            container = renderInto(<RecordMeetingButton launcherNote={{} as FNote} />);
        });
        const button = () => (container as HTMLElement | null)?.querySelector("button");

        await vi.waitFor(() => expect(button()?.className).toBe("bx bx-stop-circle"));
        await act(async () => button()?.click());
        expect(transcription.stop).toHaveBeenCalledOnce();

        for (const status of [ "starting", "stopping" ] as const) {
            await report(status);
            expect(button()?.className).toBe("bx bx-loader-alt bx-spin");
            expect(button()?.disabled).toBe(true);
            expect(button()?.textContent).toContain(`record_meeting.${status}`);
        }

        await report("idle");
        expect(button()?.className).toBe("bx bx-microphone");
        await act(async () => button()?.click());
        await vi.waitFor(() => expect(transcription.start).toHaveBeenCalledExactlyOnceWith("meeting"));
        window.electronApi = undefined;
    });
});
