"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const tree = require('../../services/tree');
const notes = require('../../services/notes');
const wrap = require('express-promise-wrap').wrap;

/**
 * Code in this file deals with moving and cloning note tree rows. Relationship between note and parent note is unique
 * for not deleted note trees. There may be multiple deleted note-parent note relationships.
 */

async function moveBranchToParent(req) {
    const branchId = req.params.branchId;
    const parentNoteId = req.params.parentNoteId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);

    const validationResult = await tree.validateParentChild(parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [400, validationResult];
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const now = utils.nowDate();

    await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
        [parentNoteId, newNotePos, now, branchId]);

    await sync_table.addBranchSync(branchId, sourceId);

    return { success: true };
}

async function moveBranchBeforeNote(req) {
    const branchId = req.params.branchId;
    const beforeBranchId = req.params.beforeBranchId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);
    const beforeNote = await tree.getBranch(beforeBranchId);

    const validationResult = await tree.validateParentChild(beforeNote.parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [400, validationResult];
    }

    // we don't change dateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified note trees otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
        [beforeNote.parentNoteId, beforeNote.notePosition]);

    await sync_table.addNoteReorderingSync(beforeNote.parentNoteId, sourceId);

    await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
        [beforeNote.parentNoteId, beforeNote.notePosition, utils.nowDate(), branchId]);

    await sync_table.addBranchSync(branchId, sourceId);

    return { success: true };
}

async function moveBranchAfterNote(req) {
    const branchId = req.params.branchId;
    const afterBranchId = req.params.afterBranchId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);
    const afterNote = await tree.getBranch(afterBranchId);

    const validationResult = await tree.validateParentChild(afterNote.parentNoteId, noteToMove.noteId, branchId);

    if (!validationResult.success) {
        return [400, validationResult];
    }

    // we don't change dateModified so other changes are prioritized in case of conflict
    // also we would have to sync all those modified note trees otherwise hash checks would fail
    await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    await sync_table.addNoteReorderingSync(afterNote.parentNoteId, sourceId);

    await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
        [afterNote.parentNoteId, afterNote.notePosition + 1, utils.nowDate(), branchId]);

    await sync_table.addBranchSync(branchId, sourceId);

    return { success: true };
}

async function setExpanded(req) {
    const branchId = req.params.branchId;
    const expanded = req.params.expanded;

    await sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);
    // we don't sync expanded label
}

async function deleteBranch(req) {
    await notes.deleteNote(req.params.branchId, req.headers.source_id);
}

module.exports = {
    moveBranchToParent,
    moveBranchBeforeNote,
    moveBranchAfterNote,
    setExpanded,
    deleteBranch
};