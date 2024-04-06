"use strict";

import sql = require('../../services/sql');
import protectedSessionService = require('../../services/protected_session');
import noteService = require('../../services/notes');
import becca = require('../../becca/becca');
import { Request } from 'express';
import { RevisionRow } from '../../becca/entities/rows';

interface RecentChangeRow {
    noteId: string;
    current_isDeleted: boolean;
    current_deleteId: string;
    current_title: string;
    current_isProtected: boolean,
    title: string;
    utcDate: string;
    date: string;
    canBeUndeleted?: boolean;
}

function getRecentChanges(req: Request) {
    const {ancestorNoteId} = req.params;

    let recentChanges = [];

    const revisionRows = sql.getRows<RecentChangeRow>(`
        SELECT 
            notes.noteId,
            notes.isDeleted AS current_isDeleted,
            notes.deleteId AS current_deleteId,
            notes.title AS current_title,
            notes.isProtected AS current_isProtected,
            revisions.title,
            revisions.utcDateCreated AS utcDate,
            revisions.dateCreated AS date
        FROM 
            revisions
            JOIN notes USING(noteId)`);

    for (const revisionRow of revisionRows) {
        const note = becca.getNote(revisionRow.noteId);

        // for deleted notes, the becca note is null, and it's not possible to (easily) determine if it belongs to a subtree
        if (ancestorNoteId === 'root' || note?.hasAncestor(ancestorNoteId)) {
            recentChanges.push(revisionRow);
        }
    }

    // now we need to also collect date points not represented in note revisions:
    // 1. creation for all notes (dateCreated)
    // 2. deletion for deleted notes (dateModified)
    const noteRows = sql.getRows<RecentChangeRow>(`
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
                change.title = protectedSessionService.decryptString(change.title) || "[protected]";
                change.current_title = protectedSessionService.decryptString(change.current_title) || "[protected]";
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

export = {
    getRecentChanges
};
