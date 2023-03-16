const sql = require('../../services/sql');
const becca = require('../../becca/becca');
const NotFoundError = require("../../errors/not_found_error");

function getNoteSize(req) {
    const {noteId} = req.params;
    const note = becca.getNote(noteId);

    const noteSize = sql.getValue(`
        SELECT
            COALESCE((SELECT LENGTH(content) FROM blobs WHERE blobId = ?), 0)
            +
            COALESCE(
                    (SELECT SUM(LENGTH(content))
                     FROM note_revisions
                              JOIN blobs USING (blobId)
                     WHERE note_revisions.noteId = ?),
                    0
            )`, [note.blobId, noteId]);

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

    const subTreeSize = sql.getValue(`
        SELECT
            COALESCE((
                SELECT SUM(LENGTH(content)) 
                FROM notes
                JOIN blobs USING (blobId)    
                JOIN param_list ON param_list.paramId = notes.noteId
            ), 0)
            +
            COALESCE(
                    (SELECT SUM(LENGTH(content))
                     FROM note_revisions
                     JOIN blobs USING (blobId)
                     JOIN param_list ON param_list.paramId = note_revisions.noteId),
                    0
            )`);

    return {
        subTreeSize,
        subTreeNoteCount: subTreeNoteIds.length
    };
}

module.exports = {
    getNoteSize,
    getSubtreeSize
};
