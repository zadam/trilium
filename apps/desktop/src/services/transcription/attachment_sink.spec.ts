import type { Transcript } from "@triliumnext/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
    saveAttachment: vi.fn(),
    setContent: vi.fn(),
    transactions: 0
}));

vi.mock("@triliumnext/core", () => ({
    becca: {
        getNoteOrThrow: (noteId: string) => ({ noteId, saveAttachment: h.saveAttachment }),
        getAttachmentOrThrow: (attachmentId: string) => ({ attachmentId, setContent: h.setContent })
    },
    cls: { init: <T>(callback: () => T) => callback() },
    getSql: () => ({
        transactional: <T>(callback: () => T) => {
            h.transactions++;
            return callback();
        }
    })
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));

const { AttachmentSink } = await import("./attachment_sink");

const STARTED_AT = Date.UTC(2026, 9, 13, 14, 30);

beforeEach(() => {
    vi.clearAllMocks();
    h.transactions = 0;
    h.saveAttachment.mockReturnValue({ attachmentId: "transcript1" });
});

describe("AttachmentSink", () => {
    it("creates an empty transcript attachment on the meeting note when it opens", () => {
        new AttachmentSink("meeting").open(STARTED_AT);

        expect(h.saveAttachment).toHaveBeenCalledExactlyOnceWith({
            role: "transcript",
            mime: "application/json",
            title: "transcription.attachment-title",
            content: expect.any(String)
        });
        const content = JSON.parse(h.saveAttachment.mock.calls[0][0].content) as Transcript;
        expect(content).toEqual({
            version: 1, startedAt: "2026-10-13T14:30:00.000Z", utterances: []
        });
    });

    it("rewrites the whole transcript after every utterance, in a transaction each", () => {
        const sink = new AttachmentSink("meeting");
        sink.open(STARTED_AT);
        sink.write({ source: "microphone", offsetMs: 1500, text: "Can you hear me?" });
        sink.write({ source: "system", offsetMs: 3000, text: "Yes." });

        expect(h.setContent).toHaveBeenCalledTimes(2);
        const last = JSON.parse(h.setContent.mock.calls[1][0]) as Transcript;
        expect(last.utterances).toEqual([
            { source: "microphone", offsetMs: 1500, text: "Can you hear me?" },
            { source: "system", offsetMs: 3000, text: "Yes." }
        ]);
        expect(h.transactions).toBe(3);
    });

    it("refuses to write before it is open", () => {
        const sink = new AttachmentSink("meeting");
        expect(() => sink.write({ source: "system", offsetMs: 0, text: "Hi" }))
            .toThrow("The transcript attachment was not created.");
        expect(h.setContent).not.toHaveBeenCalled();
    });
});
