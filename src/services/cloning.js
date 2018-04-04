"use strict";

const sql = require('./sql');
const syncTable = require('./sync_table');
const tree = require('./tree');
const Branch = require('../entities/branch');

async function cloneNoteToParent(noteId, parentNoteId, prefix) {
    const validationResult = await tree.validateParentChild(parentNoteId, noteId);

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

async function cloneNoteAfter(noteId, afterBranchId) {
    const afterNote = await tree.getBranch(afterBranchId);

    const validationResult = await tree.validateParentChild(afterNote.parentNoteId, noteId);

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
    cloneNoteAfter
};