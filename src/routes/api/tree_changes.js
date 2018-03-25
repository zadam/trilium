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

router.put('/:branchId/move-to/:parentNoteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const branchId = req.params.branchId;
    const parentNoteId = req.params.parentNoteId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);

    if (!await tree.validateParentChild(res, parentNoteId, noteToMove.noteId, branchId)) {
        return;
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
            [parentNoteId, newNotePos, now, branchId]);

        await sync_table.addBranchSync(branchId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:branchId/move-before/:beforeBranchId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const branchId = req.params.branchId;
    const beforeBranchId = req.params.beforeBranchId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);
    const beforeNote = await tree.getBranch(beforeBranchId);

    if (!await tree.validateParentChild(res, beforeNote.parentNoteId, noteToMove.noteId, branchId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change dateModified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition >= ? AND isDeleted = 0",
            [beforeNote.parentNoteId, beforeNote.notePosition]);

        await sync_table.addNoteReorderingSync(beforeNote.parentNoteId, sourceId);

        await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
            [beforeNote.parentNoteId, beforeNote.notePosition, utils.nowDate(), branchId]);

        await sync_table.addBranchSync(branchId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:branchId/move-after/:afterBranchId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const branchId = req.params.branchId;
    const afterBranchId = req.params.afterBranchId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getBranch(branchId);
    const afterNote = await tree.getBranch(afterBranchId);

    if (!await tree.validateParentChild(res, afterNote.parentNoteId, noteToMove.noteId, branchId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change dateModified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
            [afterNote.parentNoteId, afterNote.notePosition]);

        await sync_table.addNoteReorderingSync(afterNote.parentNoteId, sourceId);

        await sql.execute("UPDATE branches SET parentNoteId = ?, notePosition = ?, dateModified = ? WHERE branchId = ?",
            [afterNote.parentNoteId, afterNote.notePosition + 1, utils.nowDate(), branchId]);

        await sync_table.addBranchSync(branchId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:branchId/expanded/:expanded', auth.checkApiAuth, wrap(async (req, res, next) => {
    const branchId = req.params.branchId;
    const expanded = req.params.expanded;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE branches SET isExpanded = ? WHERE branchId = ?", [expanded, branchId]);

        // we don't sync expanded label
    });

    res.send({});
}));

router.delete('/:branchId', auth.checkApiAuth, wrap(async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await notes.deleteNote(req.params.branchId, req.headers.source_id);
    });

    res.send({});
}));

module.exports = router;