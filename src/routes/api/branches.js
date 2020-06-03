"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const syncTableService = require('../../services/sync_table');
const treeService = require('../../services/tree');
const noteService = require('../../services/notes');
const repository = require('../../services/repository');
const TaskContext = require('../../services/task_context');

/**
 * Code in this file deals with moving and cloning branches. Relationship between note and parent note is unique
 * for not deleted branches. There may be multiple deleted note-parent note relationships.
 */

async function moveBranchToParent(req) {
    const {branchId, parentBranchId} = req.params;

    const parentBranch = await repository.getBranch(parentBranchId);
    const branchToMove = await repository.getBranch(branchId);

    if (!parentBranch || !branchToMove) {
        return [400, `One or both branches ${branchId}, ${parentBranchId} have not been found`];
    }

    if (branchToMove.parentNoteId === parentBranch.noteId) {
        return { success: true }; // no-op
    }

    const validationResult = await treeService.validateParentChild(parentBranch.noteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentBranch.noteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;

    // expanding so that the new placement of the branch is immediately visible
    parentBranch.isExpanded = true;
    await parentBranch.save();

    const newBranch = branchToMove.createClone(parentBranch.noteId, newNotePos);
    await newBranch.save();

    branchToMove.isDeleted = true;
    await branchToMove.save();

    return { success: true };
}

async function moveBranchBeforeNote(req) {
    const {branchId, beforeBranchId} = req.params;

    const branchToMove = await repository.getBranch(branchId);
    const beforeNote = await repository.getBranch(beforeBranchId);

    const validationResult = await treeService.validateParentChild(beforeNote.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeNote.parentNoteId, beforeNote.notePosition]);

    await syncTableService.addNoteReorderingSync(beforeNote.parentNoteId);

    if (branchToMove.parentNoteId === beforeNote.parentNoteId) {
        branchToMove.notePosition = beforeNote.notePosition;
        await branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(beforeNote.parentNoteId, beforeNote.notePosition);
        await newBranch.save();

        branchToMove.isDeleted = true;
        await branchToMove.save();
    }

    return { success: true };
}

async function moveBranchAfterNote(req) {
    const {branchId, afterBranchId} = req.params;

    const branchToMove = await repository.getBranch(branchId);
    const afterNote = await repository.getBranch(afterBranchId);

    const validationResult = await treeService.validateParentChild(afterNote.parentNoteId, branchToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await syncTableService.addNoteReorderingSync(afterNote.parentNoteId);

    const movedNotePosition = afterNote.notePosition + 10;

    if (branchToMove.parentNoteId === afterNote.parentNoteId) {
        branchToMove.notePosition = movedNotePosition;
        await branchToMove.save();
    }
    else {
        const newBranch = branchToMove.createClone(afterNote.parentNoteId, movedNotePosition);
        await newBranch.save();

        branchToMove.isDeleted = true;
        await branchToMove.save();
    }

    return { success: true };
}

async function setExpanded(req) {
    const {branchId, expanded} = req.params;

    if (branchId !== 'root') {
        await sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
        // we don't sync expanded label
        // also this does not trigger updates to the frontend, this would trigger too many reloads
    }
}

async function setExpandedForSubtree(req) {
    const {branchId, expanded} = req.params;

    let branchIds = await sql.getColumn(`
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

    await sql.executeMany(`UPDATE branches SET isExpanded = ${expanded} WHERE branchId IN (???)`, branchIds);

    return {
        branchIds
    };
}

async function deleteBranch(req) {
    const last = req.query.last === 'true';
    const branch = await repository.getBranch(req.params.branchId);
    const taskContext = TaskContext.getInstance(req.query.taskId, 'delete-notes');

    const deleteId = utils.randomString(10);
    const noteDeleted = await noteService.deleteBranch(branch, deleteId, taskContext);

    if (last) {
        taskContext.taskSucceeded();
    }

    return {
        noteDeleted: noteDeleted
    };
}

async function setPrefix(req) {
    const branchId = req.params.branchId;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    const branch = await repository.getBranch(branchId);
    branch.prefix = prefix;
    await branch.save();
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
