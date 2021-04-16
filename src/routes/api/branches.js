"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const entityChangesService = require('../../services/entity_changes.js');
const treeService = require('../../services/tree');
const noteService = require('../../services/notes');
const becca = require('../../services/note_cache/note_cache');
const repository = require('../../services/repository');
const TaskContext = require('../../services/task_context');

/**
 * Code in this file deals with moving and cloning branches. Relationship between note and parent note is unique
 * for not deleted branches. There may be multiple deleted note-parent note relationships.
 */

function moveBranchToParent(req) {
    const {branchId, parentBranchId} = req.params;

    const parentBranch = repository.getBranch(parentBranchId);
    const branchToMove = repository.getBranch(branchId);

    if (!parentBranch || !branchToMove) {
        return [400, `One or both branches ${branchId}, ${parentBranchId} have not been found`];
    }

    if (branchToMove.parentNoteId === parentBranch.noteId) {
        return { success: true }; // no-op
    }

    const validationResult = treeService.validateParentChild(parentBranch.noteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentBranch.noteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;

    // expanding so that the new placement of the branch is immediately visible
    parentBranch.isExpanded = true;
    parentBranch.save();

    const newBranch = branchToMove.createClone(parentBranch.noteId, newNotePos);
    newBranch.save();

    branchToMove.isDeleted = true;
    branchToMove.save();

    return { success: true };
}

function moveBranchBeforeNote(req) {
    const {branchId, beforeBranchId} = req.params;

    const branchToMove = repository.getBranch(branchId);
    const beforeBranch = repository.getBranch(beforeBranchId);

    if (!branchToMove) {
        return [404, `Can't find branch ${branchId}`];
    }

    if (!beforeBranch) {
        return [404, `Can't find branch ${beforeBranchId}`];
    }

    const validationResult = treeService.validateParentChild(beforeBranch.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeBranch.parentNoteId, beforeBranch.notePosition]);

    entityChangesService.addNoteReorderingEntityChange(beforeBranch.parentNoteId);

    if (branchToMove.parentNoteId === beforeBranch.parentNoteId) {
        branchToMove.notePosition = beforeBranch.notePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(beforeBranch.parentNoteId, beforeBranch.notePosition);
        newBranch.save();

        branchToMove.isDeleted = true;
        branchToMove.save();
    }

    return { success: true };
}

function moveBranchAfterNote(req) {
    const {branchId, afterBranchId} = req.params;

    const branchToMove = repository.getBranch(branchId);
    const afterNote = repository.getBranch(afterBranchId);

    const validationResult = treeService.validateParentChild(afterNote.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    entityChangesService.addNoteReorderingEntityChange(afterNote.parentNoteId);

    const movedNotePosition = afterNote.notePosition + 10;

    if (branchToMove.parentNoteId === afterNote.parentNoteId) {
        branchToMove.notePosition = movedNotePosition;
        branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(afterNote.parentNoteId, movedNotePosition);
        newBranch.save();

        branchToMove.isDeleted = true;
        branchToMove.save();
    }

    return { success: true };
}

function setExpanded(req) {
    const {branchId} = req.params;
    const expanded = parseInt(req.params.expanded);

    if (branchId !== 'root') {
        sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
        // we don't sync expanded label
        // also this does not trigger updates to the frontend, this would trigger too many reloads

        const branch = becca.branches[branchId];

        if (branch) {
            branch.isExpanded = !!expanded;
        }
    }
}

function setExpandedForSubtree(req) {
    const {branchId} = req.params;
    const expanded = parseInt(req.params.expanded);

    let branchIds = sql.getColumn(`
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
    branchIds = branchIds.filter(branchId => branchId !== 'root');

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

function deleteBranch(req) {
    const last = req.query.last === 'true';
    const branch = repository.getBranch(req.params.branchId);
    const taskContext = TaskContext.getInstance(req.query.taskId, 'delete-notes');

    const deleteId = utils.randomString(10);
    const noteDeleted = noteService.deleteBranch(branch, deleteId, taskContext);

    if (last) {
        taskContext.taskSucceeded();
    }

    return {
        noteDeleted: noteDeleted
    };
}

function setPrefix(req) {
    const branchId = req.params.branchId;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    const branch = repository.getBranch(branchId);
    branch.prefix = prefix;
    branch.save();
}

module.exports = {
    moveBranchToParent,
    moveBranchBeforeNote,
    moveBranchAfterNote,
    setExpanded,
    setExpandedForSubtree,
    deleteBranch,
    setPrefix
};
