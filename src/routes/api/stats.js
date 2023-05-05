const sql = require('../../services/sql');
const becca = require('../../becca/becca');
const NotFoundError = require("../../errors/not_found_error");

function getNoteSize(req) {
    const {noteId} = req.params;

    const blobSizes = sql.getMap(`
        SELECT blobs.blobId, LENGTH(content)
        FROM blobs
        LEFT JOIN notes ON notes.blobId = blobs.blobId AND notes.noteId = ? AND notes.isDeleted = 0
        LEFT JOIN attachments ON attachments.blobId = blobs.blobId AND attachments.parentId = ? AND attachments.isDeleted = 0
        LEFT JOIN note_revisions ON note_revisions.blobId = blobs.blobId AND note_revisions.noteId = ?
        WHERE notes.noteId IS NOT NULL 
           OR attachments.attachmentId IS NOT NULL
           OR note_revisions.noteRevisionId IS NOT NULL`, [noteId, noteId, noteId]);

    const noteSize = Object.values(blobSizes).reduce((acc, blobSize) => acc + blobSize, 0);

    return {
        noteSize
    };
}

function getSubtreeSize(req) {
    const {noteId} = req.params;
    const note = becca.notes[noteId];

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' was not found.`);
    }

    const subTreeNoteIds = note.getSubtreeNoteIds();

    sql.fillParamList(subTreeNoteIds);

    const blobSizes = sql.getMap(`
        SELECT blobs.blobId, LENGTH(content)
        FROM param_list
        JOIN notes ON notes.noteId = param_list.paramId AND notes.isDeleted = 0
        LEFT JOIN attachments ON attachments.parentId = param_list.paramId AND attachments.isDeleted = 0
        LEFT JOIN note_revisions ON note_revisions.noteId = param_list.paramId
        JOIN blobs ON blobs.blobId = notes.blobId OR blobs.blobId = attachments.blobId OR blobs.blobId = note_revisions.blobId`);

    const subTreeSize = Object.values(blobSizes).reduce((acc, blobSize) => acc + blobSize, 0);

    return {
        subTreeSize,
        subTreeNoteCount: subTreeNoteIds.length
    };
}

module.exports = {
    getNoteSize,
    getSubtreeSize
};
