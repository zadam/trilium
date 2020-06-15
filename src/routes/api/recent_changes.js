"use strict";

const sql = require('../../services/sql');
const protectedSessionService = require('../../services/protected_session');
const noteService = require('../../services/notes');
const noteCacheService = require('../../services/note_cache');

async function getRecentChanges(req) {
    const {ancestorNoteId} = req.params;

    let recentChanges = [];

    const noteRevisions = await sql.getRows(`
        SELECT 
            notes.noteId,
            notes.isDeleted AS current_isDeleted,
            notes.deleteId AS current_deleteId,
            notes.isErased AS current_isErased,
            notes.title AS current_title,
            notes.isProtected AS current_isProtected,
            note_revisions.title,
            note_revisions.utcDateCreated AS utcDate,
            note_revisions.dateCreated AS date
        FROM 
            note_revisions
            JOIN notes USING(noteId)`);

    for (const noteRevision of noteRevisions) {
        if (noteCacheService.isInAncestor(noteRevision.noteId, ancestorNoteId)) {
            recentChanges.push(noteRevision);
        }
    }

    const notes = await sql.getRows(`
        SELECT
            notes.noteId,
            notes.isDeleted AS current_isDeleted,
            notes.deleteId AS current_deleteId,
            notes.isErased AS current_isErased,
            notes.title AS current_title,
            notes.isProtected AS current_isProtected,
            notes.title,
            notes.utcDateCreated AS utcDate,
            notes.dateCreated AS date
        FROM
            notes`);

    for (const note of notes) {
        if (noteCacheService.isInAncestor(note.noteId, ancestorNoteId)) {
            recentChanges.push(note);
        }
    }

    recentChanges.sort((a, b) => a.utcDate > b.utcDate ? -1 : 1);

    recentChanges = recentChanges.slice(0, Math.min(500, recentChanges.length));

    console.log(recentChanges);

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
