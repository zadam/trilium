"use strict";

const sql = require('./sql');
const eventChangesService = require('./entity_changes');
const treeService = require('./tree');
const noteService = require('./notes');
const Branch = require('../becca/entities/branch');
const TaskContext = require("./task_context");
const utils = require('./utils');
const becca = require("../becca/becca");
const beccaService = require("../becca/becca_service");

function cloneNoteToNote(noteId, parentNoteId, prefix) {
    if (parentNoteId === 'share') {
        const specialNotesService = require('./special_notes');
        // share root note is created lazily
        specialNotesService.getShareRoot();
    }

    if (isNoteDeleted(noteId) || isNoteDeleted(parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    const branch = new Branch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();

    return {
        success: true,
        branchId: branch.branchId,
        notePath: beccaService.getNotePath(parentNoteId).path + "/" + noteId
    };
}

function cloneNoteToBranch(noteId, parentBranchId, prefix) {
    const parentBranch = becca.getBranch(parentBranchId);

    if (!parentBranch) {
        return { success: false, message: `Parent branch ${parentBranchId} does not exist.` };
    }

    const ret = cloneNoteToNote(noteId, parentBranch.noteId, prefix);

    parentBranch.isExpanded = true; // the new target should be expanded so it immediately shows up to the user
    parentBranch.save();

    return ret;
}

function ensureNoteIsPresentInParent(noteId, parentNoteId, prefix) {
    if (isNoteDeleted(noteId) || isNoteDeleted(parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    new Branch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();
}

function ensureNoteIsAbsentFromParent(noteId, parentNoteId) {
    const branchId = sql.getValue(`SELECT branchId FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0`, [noteId, parentNoteId]);
    const branch = becca.getBranch(branchId);

    if (branch) {
        const deleteId = utils.randomString(10);
        noteService.deleteBranch(branch, deleteId, new TaskContext());
    }
}

function toggleNoteInParent(present, noteId, parentNoteId, prefix) {
    if (present) {
        ensureNoteIsPresentInParent(noteId, parentNoteId, prefix);
    }
    else {
        ensureNoteIsAbsentFromParent(noteId, parentNoteId);
    }
}

function cloneNoteAfter(noteId, afterBranchId) {
    const afterNote = becca.getBranch(afterBranchId);

    if (isNoteDeleted(noteId) || isNoteDeleted(afterNote.parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = treeService.validateParentChild(afterNote.parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    eventChangesService.addNoteReorderingEntityChange(afterNote.parentNoteId);

    const branch = new Branch({
        noteId: noteId,
        parentNoteId: afterNote.parentNoteId,
        notePosition: afterNote.notePosition + 10,
        isExpanded: 0
    }).save();

    return { success: true, branchId: branch.branchId };
}

function isNoteDeleted(noteId) {
    const note = becca.getNote(noteId);

    return note.isDeleted;
}

module.exports = {
    cloneNoteToBranch,
    cloneNoteToNote,
    ensureNoteIsPresentInParent,
    ensureNoteIsAbsentFromParent,
    toggleNoteInParent,
    cloneNoteAfter
};
