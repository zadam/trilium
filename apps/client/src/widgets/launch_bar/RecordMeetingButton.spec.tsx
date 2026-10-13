import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getInboxNote: vi.fn(),
    createNote: vi.fn()
}));

vi.mock("../../services/date_notes", () => ({
    default: { getInboxNote: mocks.getInboxNote }
}));
vi.mock("../../services/note_create", () => ({
    default: { createNote: mocks.createNote }
}));
vi.mock("../../services/i18n", () => ({
    t: (key: string, options?: { date?: string }) => `${key} ${options?.date}`
}));

import { createMeetingNote } from "./RecordMeetingButton";

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
