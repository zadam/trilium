const sql = require('../../services/sql');
const becca = require('../../becca/becca');
const NotFoundError = require("../../errors/not_found_error");

function getNoteSize(req) {
    const {noteId} = req.params;

    const noteSize = sql.getValue(`
        SELECT
            COALESCE((SELECT LENGTH(content) FROM note_contents WHERE noteId = ?), 0)
            +
            COALESCE(
                    (SELECT SUM(LENGTH(content))
                     FROM note_revisions
                              JOIN note_revision_contents USING (noteRevisionId)
                     WHERE note_revisions.noteId = ?),
                    0
            )`, [noteId, noteId]);

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
                FROM note_contents 
                JOIN param_list ON param_list.paramId = note_contents.noteId
            ), 0)
            +
            COALESCE(
                    (SELECT SUM(LENGTH(content))
                     FROM note_revisions
                     JOIN note_revision_contents USING (noteRevisionId)
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
