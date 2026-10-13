import { type Transcript, TRANSCRIPT_MIME, type TranscriptUtterance } from "@triliumnext/commons";
import { becca, cls, getSql } from "@triliumnext/core";
import { t } from "i18next";

import type { TranscriptSink } from "./session";

/**
 * Keeps the transcript in a `transcript` attachment of the meeting note, rewritten after every
 * utterance. Each write commits its own transaction, which sends the change to every open window.
 */
export class AttachmentSink implements TranscriptSink {
    private transcript: Transcript | null = null;
    private attachmentId: string | null = null;

    constructor(private readonly noteId: string) {}

    open(startedAt: number) {
        this.transcript = {
            version: 1,
            startedAt: new Date(startedAt).toISOString(),
            utterances: []
        };
        const content = serialize(this.transcript);
        this.attachmentId = inTransaction(() => becca.getNoteOrThrow(this.noteId).saveAttachment({
            role: "transcript",
            mime: TRANSCRIPT_MIME,
            title: t("transcription.attachment-title"),
            content
        }).attachmentId) ?? null;
    }

    write(utterance: TranscriptUtterance) {
        const { transcript, attachmentId } = this;
        if (!transcript || !attachmentId) {
            throw new Error("The transcript attachment was not created.");
        }

        transcript.utterances.push(utterance);
        const content = serialize(transcript);
        inTransaction(() => becca.getAttachmentOrThrow(attachmentId).setContent(content));
    }
}

function serialize(transcript: Transcript) {
    return JSON.stringify(transcript, null, 2);
}

function inTransaction<T>(callback: () => T): T {
    return cls.init(() => getSql().transactional(callback));
}
