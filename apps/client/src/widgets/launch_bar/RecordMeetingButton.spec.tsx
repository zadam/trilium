import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getInboxNote: vi.fn(),
    createNote: vi.fn(),
    showError: vi.fn()
}));

vi.mock("../../services/date_notes", () => ({
    default: { getInboxNote: mocks.getInboxNote }
}));
vi.mock("../../services/note_create", () => ({
    default: { createNote: mocks.createNote }
}));
vi.mock("../../services/toast", () => ({
    default: { showError: mocks.showError }
}));
vi.mock("../../services/i18n", () => ({
    t: (key: string, options?: { date?: string }) => `${key} ${options?.date}`
}));

import { createMeetingNote, toggleRecording } from "./RecordMeetingButton";

beforeEach(() => {
    vi.clearAllMocks();
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

    it("does nothing outside the desktop app", async () => {
        window.electronApi = undefined;
        await toggleRecording("idle");
        expect(mocks.createNote).not.toHaveBeenCalled();
    });
});
