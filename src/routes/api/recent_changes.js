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
                notes.deleteId AS current_deleteId,
                notes.isErased AS current_isErased,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                note_revisions.title,
                note_revisions.utcDateCreated AS date
            FROM 
                note_revisions
                JOIN notes USING(noteId)
            ORDER BY
                note_revisions.utcDateCreated DESC
            LIMIT 200
        )
        UNION ALL SELECT * FROM (
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.deleteId AS current_deleteId,
                notes.isErased AS current_isErased,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateModified AS date
            FROM
                notes
            ORDER BY
                utcDateModified DESC
            LIMIT 200
        )
        ORDER BY date DESC 
        LIMIT 200`);

    for (const change of recentChanges) {
        if (change.current_isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                change.title = protectedSessionService.decryptString(change.title);
                change.current_title = protectedSessionService.decryptString(change.current_title);
            }
            else {
                change.title = change.current_title = "[Protected]";
            }
        }

        if (change.current_isDeleted) {
            if (change.current_isErased) {
                change.canBeUndeleted = false;
            }
            else {
                const deleteId = change.current_deleteId;

                const undeletedParentCount = await sql.getValue(`
                    SELECT COUNT(parentNote.noteId)
                    FROM branches
                    JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
                    WHERE branches.noteId = ?
                      AND branches.isDeleted = 1
                      AND branches.deleteId = ?
                      AND parentNote.isDeleted = 0`, [change.noteId, deleteId]);

                // note (and the subtree) can be undeleted if there's at least one undeleted parent (whose branch would be undeleted by this op)
                change.canBeUndeleted = undeletedParentCount > 0;
            }
        }
    }

    return recentChanges;
}

module.exports = {
    getRecentChanges
};