"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const wrap = require('express-promise-wrap').wrap;
const tree = require('../../services/tree');

router.put('/:childNoteId/clone-to/:parentNoteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const parentNoteId = req.params.parentNoteId;
    const childNoteId = req.params.childNoteId;
    const prefix = req.body.prefix;
    const sourceId = req.headers.source_id;

    if (!await tree.validateParentChild(res, parentNoteId, childNoteId)) {
        return;
    }

    const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    await sql.doInTransaction(async () => {
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

        await sync_table.addBranchSync(branch.branchId, sourceId);

        await sql.execute("UPDATE branches SET isExpanded = 1 WHERE noteId = ?", [parentNoteId]);
    });

    res.send({ success: true });
}));

router.put('/:noteId/clone-after/:afterBranchId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const afterBranchId = req.params.afterBranchId;
    const sourceId = req.headers.source_id;

    const afterNote = await tree.getBranch(afterBranchId);

    if (!await tree.validateParentChild(res, afterNote.parentNoteId, noteId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change dateModified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
            [afterNote.parentNoteId, afterNote.notePosition]);

        await sync_table.addNoteReorderingSync(afterNote.parentNoteId, sourceId);

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

        await sync_table.addBranchSync(branch.branchId, sourceId);
    });

    res.send({ success: true });
}));

module.exports = router;