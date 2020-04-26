"use strict";

const sql = require('../../services/sql');
const protectedSessionService = require('../../services/protected_session');
const noteService = require('../../services/notes');
const noteCacheService = require('../../services/note_cache');

async function getRecentChanges(req) {
    const {ancestorNoteId} = req.params;

    const noteRows = await sql.getRows(
        `
        SELECT * FROM (
            SELECT note_revisions.noteId,
                   note_revisions.noteRevisionId,
                   note_revisions.dateLastEdited AS date
            FROM note_revisions
            ORDER BY note_revisions.dateLastEdited DESC
        )
        UNION ALL SELECT * FROM (
            SELECT 
                   notes.noteId,
                   NULL AS noteRevisionId,
                   dateModified AS date 
            FROM notes 
            ORDER BY dateModified DESC
        )
        ORDER BY date DESC`);

    const recentChanges = [];

    for (const noteRow of noteRows) {
        if (!noteCacheService.isInAncestor(noteRow.noteId, ancestorNoteId)) {
            continue;
        }

        if (noteRow.noteRevisionId) {
            recentChanges.push(await sql.getRow(`
                SELECT 
                    notes.noteId,
                    notes.isDeleted AS current_isDeleted,
                    notes.deleteId AS current_deleteId,
                    notes.isErased AS current_isErased,
                    notes.title AS current_title,
                    notes.isProtected AS current_isProtected,
                    note_revisions.title,
                    note_revisions.dateCreated AS date
                FROM 
                    note_revisions
                    JOIN notes USING(noteId)
                WHERE noteRevisionId = ?`, [noteRow.noteRevisionId]));
        }
        else {
            recentChanges.push(await sql.getRow(`
                SELECT
                    notes.noteId,
                    notes.isDeleted AS current_isDeleted,
                    notes.deleteId AS current_deleteId,
                    notes.isErased AS current_isErased,
                    notes.title AS current_title,
                    notes.isProtected AS current_isProtected,
                    notes.title,
                    notes.dateModified AS date
                FROM
                    notes
                WHERE noteId = ?`, [noteRow.noteId]));
        }

        if (recentChanges.length >= 200) {
            break;
        }
    }

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

                const undeletedParentBranches = await noteService.getUndeletedParentBranches(change.noteId, deleteId);

                // note (and the subtree) can be undeleted if there's at least one undeleted parent (whose branch would be undeleted by this op)
                change.canBeUndeleted = undeletedParentBranches.length > 0;
            }
        }
    }

    return recentChanges;
}

module.exports = {
    getRecentChanges
};