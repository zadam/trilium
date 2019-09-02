"use strict";

const sql = require('../../services/sql');
const protectedSessionService = require('../../services/protected_session');

async function getRecentChanges() {
    const recentChanges = await sql.getRows(
        `
        SELECT * FROM (
            SELECT 
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                note_revisions.title,
                note_revisions.utcDateModifiedTo AS date
            FROM 
                note_revisions
                JOIN notes USING(noteId)
            ORDER BY 
                utcDateModifiedTo DESC
            LIMIT 1000
        )
        UNION ALL SELECT * FROM (
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateCreated AS date
            FROM
                notes
            ORDER BY
                utcDateCreated DESC
            LIMIT 1000
        )
        ORDER BY date DESC 
        LIMIT 200`);

    for (const change of recentChanges) {
        if (change.current_isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                change.title = protectedSessionService.decryptNoteTitle(change.noteId, change.title);
                change.current_title = protectedSessionService.decryptNoteTitle(change.noteId, change.current_title);
            }
            else {
                change.title = change.current_title = "[Protected]";
            }
        }
    }

    return recentChanges;
}

module.exports = {
    getRecentChanges
};