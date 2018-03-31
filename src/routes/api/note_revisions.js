"use strict";

const sql = require('../../services/sql');
const protected_session = require('../../services/protected_session');

async function getNoteRevisions(req) {
    const noteId = req.params.noteId;
    const revisions = await sql.getRows("SELECT * FROM note_revisions WHERE noteId = ? order by dateModifiedTo desc", [noteId]);
    protected_session.decryptNoteRevisions(revisions);

    return revisions;
}

module.exports = {
    getNoteRevisions
};