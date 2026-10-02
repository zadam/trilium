import becca from "../../becca/becca.js";
import type { Request } from "../../http_interface";
import { NoteSizeResponse, SubtreeSizeResponse } from "@triliumnext/commons";
import { getSql } from "../../services/sql/index.js";

function getNoteSize(req: Request<{ noteId: string }>) {
    return {
        noteSize: computeNoteSize(req.params.noteId)
    } satisfies NoteSizeResponse;
}

/** The bytes a note's content, attachments and revisions take, each blob counted once. */
export function computeNoteSize(noteId: string): number {
    const blobSizes = getSql().getMap<string, number>(
        `
        SELECT blobs.blobId, LENGTH(content)
        FROM blobs
        LEFT JOIN notes ON notes.blobId = blobs.blobId AND notes.noteId = ? AND notes.isDeleted = 0
        LEFT JOIN attachments ON attachments.blobId = blobs.blobId AND attachments.ownerId = ? AND attachments.isDeleted = 0
        LEFT JOIN revisions ON revisions.blobId = blobs.blobId AND revisions.noteId = ?
        WHERE notes.noteId IS NOT NULL
            OR attachments.attachmentId IS NOT NULL
            OR revisions.revisionId IS NOT NULL`,
        [noteId, noteId, noteId]
    );

    return Object.values(blobSizes).reduce((acc, blobSize) => acc + blobSize, 0);
}

function getSubtreeSize(req: Request<{ noteId: string }>) {
    const note = becca.getNoteOrThrow(req.params.noteId);
    const subTreeNoteIds = note.getSubtreeNoteIds();
    const sql = getSql();
    sql.fillParamList(subTreeNoteIds);

    const blobSizes = sql.getMap<string, number>(`
        SELECT blobs.blobId, LENGTH(content)
        FROM param_list
        JOIN notes ON notes.noteId = param_list.paramId AND notes.isDeleted = 0
        LEFT JOIN attachments ON attachments.ownerId = param_list.paramId AND attachments.isDeleted = 0
        LEFT JOIN revisions ON revisions.noteId = param_list.paramId
        JOIN blobs ON blobs.blobId = notes.blobId OR blobs.blobId = attachments.blobId OR blobs.blobId = revisions.blobId`);

    const subTreeSize = Object.values(blobSizes).reduce((acc, blobSize) => acc + blobSize, 0);

    return {
        subTreeSize,
        subTreeNoteCount: subTreeNoteIds.length
    } satisfies SubtreeSizeResponse;
}

export default {
    getNoteSize,
    getSubtreeSize
};
