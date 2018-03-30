"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const tree = require('../../services/tree');

async function cloneNoteToParent(req) {
    const parentNoteId = req.params.parentNoteId;
    const childNoteId = req.params.childNoteId;
    const prefix = req.body.prefix;

    const validationResult = await tree.validateParentChild(parentNoteId, childNoteId);

    if (!validationResult.success) {
        return validationResult;
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const branch = {
        branchId: utils.newBranchId(),
        noteId: childNoteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        notePosition: newNotePos,
        isExpanded: 0,
        dateModified: utils.nowDate(),
        isDeleted: 0
    };

    await sql.replace("branches", branch);

    await sync_table.addBranchSync(branch.branchId);

    await sql.execute("UPDATE branches SET isExpanded = 1 WHERE noteId = ?", [parentNoteId]);

    return { success: true };
}

async function cloneNoteAfter(req) {
    const noteId = req.params.noteId;
    const afterBranchId = req.params.afterBranchId;

    const afterNote = await tree.getBranch(afterBranchId);

    const validationResult = await tree.validateParentChild(afterNote.parentNoteId, noteId);

    if (!validationResult.result) {
        return validationResult;
    }

    // we don't change dateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified note trees otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await sync_table.addNoteReorderingSync(afterNote.parentNoteId);

    const branch = {
        branchId: utils.newBranchId(),
        noteId: noteId,
        parentNoteId: afterNote.parentNoteId,
        notePosition: afterNote.notePosition + 1,
        isExpanded: 0,
        dateModified: utils.nowDate(),
        isDeleted: 0
    };

    await sql.replace("branches", branch);

    await sync_table.addBranchSync(branch.branchId);

    return { success: true };
}

module.exports = {
    cloneNoteToParent,
    cloneNoteAfter
};