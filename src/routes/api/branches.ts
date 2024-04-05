"use strict";

import sql = require('../../services/sql');
import utils = require('../../services/utils');
import entityChangesService = require('../../services/entity_changes');
import treeService = require('../../services/tree');
import eraseService = require('../../services/erase');
import becca = require('../../becca/becca');
import TaskContext = require('../../services/task_context');
import branchService = require('../../services/branches');
import log = require('../../services/log');
import ValidationError = require('../../errors/validation_error');
import eventService = require("../../services/events");
import { Request } from 'express';

/**
 * Code in this file deals with moving and cloning branches. The relationship between note and parent note is unique
 * for not deleted branches. There may be multiple deleted note-parent note relationships.
 */

function moveBranchToParent(req: Request) {
    const {branchId, parentBranchId} = req.params;

    const branchToMove = becca.getBranch(branchId);
    const targetParentBranch = becca.getBranch(parentBranchId);

    if (!branchToMove || !targetParentBranch) {
        throw new ValidationError(`One or both branches '${branchId}', '${parentBranchId}' have not been found`);
    }

    return branchService.moveBranchToBranch(branchToMove, targetParentBranch, branchId);
}

function moveBranchBeforeNote(req: Request) {
    const {branchId, beforeBranchId} = req.params;

    const branchToMove = becca.getBranchOrThrow(branchId);
    const beforeBranch = becca.getBranchOrThrow(beforeBranchId);

    const validationResult = treeService.validateParentChild(beforeBranch.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const originalBeforeNotePosition = beforeBranch.notePosition;

    // we don't change utcDateModified, so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail

    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeBranch.parentNoteId, originalBeforeNotePosition]);

    // also need to update becca positions
    const parentNote = becca.getNoteOrThrow(beforeBranch.parentNoteId);

    for (const childBranch of parentNote.getChildBranches()) {
        if (childBranch.notePosition >= originalBeforeNotePosition) {
            childBranch.notePosition += 10;
        }
    }

    if (branchToMove.parentNoteId === beforeBranch.parentNoteId) {
        branchToMove.notePosition = originalBeforeNotePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(beforeBranch.parentNoteId, originalBeforeNotePosition);
        newBranch.save();

        branchToMove.markAsDeleted();
    }

    treeService.sortNotesIfNeeded(parentNote.noteId);

    // if sorting is not needed, then still the ordering might have changed above manually
    entityChangesService.putNoteReorderingEntityChange(parentNote.noteId);

    log.info(`Moved note ${branchToMove.noteId}, branch ${branchId} before note ${beforeBranch.noteId}, branch ${beforeBranchId}`);

    return { success: true };
}

function moveBranchAfterNote(req: Request) {
    const {branchId, afterBranchId} = req.params;

    const branchToMove = becca.getBranchOrThrow(branchId);
    const afterNote = becca.getBranchOrThrow(afterBranchId);

    const validationResult = treeService.validateParentChild(afterNote.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const originalAfterNotePosition = afterNote.notePosition;

    // we don't change utcDateModified, so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, originalAfterNotePosition]);

    // also need to update becca positions
    const parentNote = becca.getNoteOrThrow(afterNote.parentNoteId);

    for (const childBranch of parentNote.getChildBranches()) {
        if (childBranch.notePosition > originalAfterNotePosition) {
            childBranch.notePosition += 10;
        }
    }

    const movedNotePosition = originalAfterNotePosition + 10;

    if (branchToMove.parentNoteId === afterNote.parentNoteId) {
        branchToMove.notePosition = movedNotePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(afterNote.parentNoteId, movedNotePosition);
        newBranch.save();

        branchToMove.markAsDeleted();
    }

    treeService.sortNotesIfNeeded(parentNote.noteId);

    // if sorting is not needed, then still the ordering might have changed above manually
    entityChangesService.putNoteReorderingEntityChange(parentNote.noteId);

    log.info(`Moved note ${branchToMove.noteId}, branch ${branchId} after note ${afterNote.noteId}, branch ${afterBranchId}`);

    return { success: true };
}

function setExpanded(req: Request) {
    const {branchId} = req.params;
    const expanded = parseInt(req.params.expanded);

    if (branchId !== 'none_root') {
        sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
        // we don't sync expanded label
        // also this does not trigger updates to the frontend, this would trigger too many reloads

        const branch = becca.branches[branchId];

        if (branch) {
            branch.isExpanded = !!expanded;
        }

        eventService.emit(eventService.ENTITY_CHANGED, {
            entityName: 'branches',
            entity: branch
        });
    }
}

function setExpandedForSubtree(req: Request) {
    const {branchId} = req.params;
    const expanded = parseInt(req.params.expanded);

    let branchIds = sql.getColumn<string>(`
        WITH RECURSIVE
        tree(branchId, noteId) AS (
            SELECT branchId, noteId FROM branches WHERE branchId = ?
            UNION
            SELECT branches.branchId, branches.noteId FROM branches
                JOIN tree ON branches.parentNoteId = tree.noteId
            WHERE branches.isDeleted = 0
        )
        SELECT branchId FROM tree`, [branchId]);

    // root is always expanded
    branchIds = branchIds.filter(branchId => branchId !== 'none_root');

    sql.executeMany(`UPDATE branches SET isExpanded = ${expanded} WHERE branchId IN (???)`, branchIds);

    for (const branchId of branchIds) {
        const branch = becca.branches[branchId];

        if (branch) {
            branch.isExpanded = !!expanded;
        }
    }

    return {
        branchIds
    };
}

function deleteBranch(req: Request) {
    const last = req.query.last === 'true';
    const eraseNotes = req.query.eraseNotes === 'true';
    const branch = becca.getBranchOrThrow(req.params.branchId);

    const taskContext = TaskContext.getInstance(req.query.taskId as string, 'deleteNotes');

    const deleteId = utils.randomString(10);
    let noteDeleted;

    if (eraseNotes) {
        // erase automatically means deleting all clones + note itself
        branch.getNote().deleteNote(deleteId, taskContext);
        eraseService.eraseNotesWithDeleteId(deleteId);
        noteDeleted = true;
    } else {
        noteDeleted = branch.deleteBranch(deleteId, taskContext);
    }

    if (last) {
        taskContext.taskSucceeded();
    }

    return {
        noteDeleted: noteDeleted
    };
}

function setPrefix(req: Request) {
    const branchId = req.params.branchId;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    const branch = becca.getBranchOrThrow(branchId);
    branch.prefix = prefix;
    branch.save();
}

export = {
    moveBranchToParent,
    moveBranchBeforeNote,
    moveBranchAfterNote,
    setExpanded,
    setExpandedForSubtree,
    deleteBranch,
    setPrefix
};
