"use strict";

const sql = require('../../services/sql');
const protectedSessionService = require('../../services/protected_session');
const noteService = require('../../services/notes');
const beccaService = require('../../becca/becca_service');

function getRecentChanges(req) {
    const {ancestorNoteId} = req.params;

    let recentChanges = [];

    const noteRevisions = sql.getRows(`
        SELECT 
            notes.noteId,
            notes.isDeleted AS current_isDeleted,
            notes.deleteId AS current_deleteId,
            notes.title AS current_title,
            notes.isProtected AS current_isProtected,
            note_revisions.title,
            note_revisions.utcDateCreated AS utcDate,
            note_revisions.dateCreated AS date
        FROM 
            note_revisions
            JOIN notes USING(noteId)`);

    for (const noteRevision of noteRevisions) {
        if (beccaService.isInAncestor(noteRevision.noteId, ancestorNoteId)) {
            recentChanges.push(noteRevision);
        }
    }

    // now we need to also collect date points not represented in note revisions:
    // 1. creation for all notes (dateCreated)
    // 2. deletion for deleted notes (dateModified)
    const notes = sql.getRows(`
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.deleteId AS current_deleteId,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateCreated AS utcDate,
                notes.dateCreated AS date
            FROM notes
        UNION ALL
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.deleteId AS current_deleteId,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateModified AS utcDate,
                notes.dateModified AS date
            FROM notes
            WHERE notes.isDeleted = 1`);

    for (const note of notes) {
        if (beccaService.isInAncestor(note.noteId, ancestorNoteId)) {
            recentChanges.push(note);
        }
    }

    recentChanges.sort((a, b) => a.utcDate > b.utcDate ? -1 : 1);

    recentChanges = recentChanges.slice(0, Math.min(500, recentChanges.length));

    for (const change of recentChanges) {
        if (change.current_isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                change.title = protectedSessionService.decryptString(change.title);
                change.current_title = protectedSessionService.decryptString(change.current_title);
            }
            else {
                change.title = change.current_title = "[protected]";
            }
        }

        if (change.current_isDeleted) {
            const deleteId = change.current_deleteId;

            const undeletedParentBranchIds = noteService.getUndeletedParentBranchIds(change.noteId, deleteId);

            // note (and the subtree) can be undeleted if there's at least one undeleted parent (whose branch would be undeleted by this op)
            change.canBeUndeleted = undeletedParentBranchIds.length > 0;
        }
    }

    return recentChanges;
}

module.exports = {
    getRecentChanges
};
