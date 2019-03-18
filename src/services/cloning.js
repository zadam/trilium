"use strict";

const sql = require('./sql');
const syncTable = require('./sync_table');
const treeService = require('./tree');
const noteService = require('./notes');
const repository = require('./repository');
const Branch = require('../entities/branch');

async function cloneNoteToParent(noteId, parentNoteId, prefix) {
    if (await isNoteDeleted(noteId) || await isNoteDeleted(parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = await treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    const branch = await new Branch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();

    await sql.execute("UPDATE branches SET isExpanded = 1 WHERE noteId = ?", [parentNoteId]);

    return { success: true, branchId: branch.branchId };
}

async function ensureNoteIsPresentInParent(noteId, parentNoteId, prefix) {
    if (await isNoteDeleted(noteId) || await isNoteDeleted(parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = await treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    await new Branch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();
}

async function ensureNoteIsAbsentFromParent(noteId, parentNoteId) {
    const branch = await repository.getEntity(`SELECT * FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0`, [noteId, parentNoteId]);

    if (branch) {
        await noteService.deleteNote(branch);
    }
}

async function toggleNoteInParent(present, noteId, parentNoteId, prefix) {
    if (present) {
        await ensureNoteIsPresentInParent(noteId, parentNoteId, prefix);
    }
    else {
        await ensureNoteIsAbsentFromParent(noteId, parentNoteId);
    }
}

async function cloneNoteAfter(noteId, afterBranchId) {
    const afterNote = await treeService.getBranch(afterBranchId);

    if (await isNoteDeleted(noteId) || await isNoteDeleted(afterNote.parentNoteId)) {
        return { success: false, message: 'Note is deleted.' };
    }

    const validationResult = await treeService.validateParentChild(afterNote.parentNoteId, noteId);

    if (!validationResult.result) {
        return validationResult;
    }

    // we don't change utcDateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await syncTable.addNoteReorderingSync(afterNote.parentNoteId);

    const branch = await new Branch({
        noteId: noteId,
        parentNoteId: afterNote.parentNoteId,
        notePosition: afterNote.notePosition + 1,
        isExpanded: 0
    }).save();

    return { success: true, branchId: branch.branchId };
}

async function isNoteDeleted(noteId) {
    const note = await repository.getNote(noteId);

    return note.isDeleted;
}

module.exports = {
    cloneNoteToParent,
    ensureNoteIsPresentInParent,
    ensureNoteIsAbsentFromParent,
    toggleNoteInParent,
    cloneNoteAfter
};