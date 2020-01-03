"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const tree = require('../../services/tree');
const notes = require('../../services/notes');
const repository = require('../../services/repository');
const TaskContext = require('../../services/task_context');

/**
 * Code in this file deals with moving and cloning branches. Relationship between note and parent note is unique
 * for not deleted branches. There may be multiple deleted note-parent note relationships.
 */

async function moveBranchToParent(req) {
    const {branchId, parentNoteId} = req.params;

    const noteToMove = await tree.getBranch(branchId);

    const validationResult = await tree.validateParentChild(parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;

    const branch = await repository.getBranch(branchId);
    branch.parentNoteId = parentNoteId;
    branch.notePosition = newNotePos;
    await branch.save();

    return { success: true };
}

async function moveBranchBeforeNote(req) {
    const {branchId, beforeBranchId} = req.params;

    const noteToMove = await tree.getBranch(branchId);
    const beforeNote = await tree.getBranch(beforeBranchId);

    const validationResult = await tree.validateParentChild(beforeNote.parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeNote.parentNoteId, beforeNote.notePosition]);

    await sync_table.addNoteReorderingSync(beforeNote.parentNoteId);

    const branch = await repository.getBranch(branchId);
    branch.parentNoteId = beforeNote.parentNoteId;
    branch.notePosition = beforeNote.notePosition;
    await branch.save();

    return { success: true };
}

async function moveBranchAfterNote(req) {
    const {branchId, afterBranchId} = req.params;

    const noteToMove = await tree.getBranch(branchId);
    const afterNote = await tree.getBranch(afterBranchId);

    const validationResult = await tree.validateParentChild(afterNote.parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await sync_table.addNoteReorderingSync(afterNote.parentNoteId);

    const branch = await repository.getBranch(branchId);
    branch.parentNoteId = afterNote.parentNoteId;
    branch.notePosition = afterNote.notePosition + 10;
    await branch.save();

    return { success: true };
}

async function setExpanded(req) {
    const {branchId, expanded} = req.params;

    await sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
    // we don't sync expanded label
}

async function deleteBranch(req) {
    const last = req.query.last === 'true';
    const branch = await repository.getBranch(req.params.branchId);
    const taskContext = TaskContext.getInstance(req.query.taskId, 'delete-notes');

    const deleteId = utils.randomString(10);
    const noteDeleted = await notes.deleteBranch(branch, deleteId, taskContext);

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
    deleteBranch,
    setPrefix
};