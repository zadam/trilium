"use strict";

const sql = require('./sql');
const syncTable = require('./sync_table');
const treeService = require('./tree');
const noteService = require('./notes');
const repository = require('./repository');
const Branch = require('../entities/branch');

async function cloneNoteToParent(noteId, parentNoteId, prefix) {
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

    await sql.execute("UPDATE branches SET isExpanded = 1 WHERE noteId = ?", [parentNoteId]);

    return { success: true };
}

// this is identical to cloneNoteToParent except for the intention - if cloned note is already in parent,
// then this is successful result
async function ensureNoteIsPresentInParent(noteId, parentNoteId, prefix) {
    await cloneNoteToParent(noteId, parentNoteId, prefix);
}

async function ensureNoteIsAbsentFromParent(noteId, parentNoteId) {
    const branch = await repository.getEntity(`SELECT * FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0`, [noteId, parentNoteId]);

    if (branch) {
        await noteService.deleteNote(branch);
    }
}

async function cloneNoteAfter(noteId, afterBranchId) {
    const afterNote = await treeService.getBranch(afterBranchId);

    const validationResult = await treeService.validateParentChild(afterNote.parentNoteId, noteId);

    if (!validationResult.result) {
        return validationResult;
    }

    // we don't change dateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await syncTable.addNoteReorderingSync(afterNote.parentNoteId);

    await new Branch({
        noteId: noteId,
        parentNoteId: afterNote.parentNoteId,
        notePosition: afterNote.notePosition + 1,
        isExpanded: 0
    }).save();

    return { success: true };
}

module.exports = {
    cloneNoteToParent,
    ensureNoteIsPresentInParent,
    ensureNoteIsAbsentFromParent,
    cloneNoteAfter
};