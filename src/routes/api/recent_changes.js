"use strict";

const sql = require('../../services/sql');
const protectedSessionService = require('../../services/protected_session');
const noteService = require('../../services/notes');
const becca = require("../../becca/becca");

function getRecentChanges(req) {
    const {ancestorNoteId} = req.params;

    let recentChanges = [];

    const noteRevisionRows = sql.getRows(`
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

    for (const noteRevisionRow of noteRevisionRows) {
        const note = becca.getNote(noteRevisionRow.noteId);

        // for deleted notes, the becca note is null, and it's not possible to (easily) determine if it belongs to a subtree
        if (ancestorNoteId === 'root' || note?.hasAncestor(ancestorNoteId)) {
            recentChanges.push(noteRevisionRow);
        }
    }

    // now we need to also collect date points not represented in note revisions:
    // 1. creation for all notes (dateCreated)
    // 2. deletion for deleted notes (dateModified)
    const noteRows = sql.getRows(`
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.deleteId AS current_deleteId,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateCreated AS utcDate, -- different from the second SELECT
                notes.dateCreated AS date        -- different from the second SELECT
            FROM notes
        UNION ALL
            SELECT
                notes.noteId,
                notes.isDeleted AS current_isDeleted,
                notes.deleteId AS current_deleteId,
                notes.title AS current_title,
                notes.isProtected AS current_isProtected,
                notes.title,
                notes.utcDateModified AS utcDate, -- different from the first SELECT
                notes.dateModified AS date        -- different from the first SELECT
            FROM notes
            WHERE notes.isDeleted = 1`);

    for (const noteRow of noteRows) {
        const note = becca.getNote(noteRow.noteId);

        // for deleted notes, the becca note is null, and it's not possible to (easily) determine if it belongs to a subtree
        if (ancestorNoteId === 'root' || note?.hasAncestor(ancestorNoteId)) {
            recentChanges.push(noteRow);
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
