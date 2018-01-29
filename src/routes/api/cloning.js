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

    const maxNotePos = await sql.getFirstValue('SELECT MAX(notePosition) FROM note_tree WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    await sql.doInTransaction(async () => {
        const noteTree = {
            noteTreeId: utils.newNoteTreeId(),
            noteId: childNoteId,
            parentNoteId: parentNoteId,
            prefix: prefix,
            notePosition: newNotePos,
            isExpanded: 0,
            dateModified: utils.nowDate(),
            isDeleted: 0
        };

        await sql.replace("note_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.noteTreeId, sourceId);

        await sql.execute("UPDATE note_tree SET isExpanded = 1 WHERE noteId = ?", [parentNoteId]);
    });

    res.send({ success: true });
}));

router.put('/:noteId/clone-after/:afterNoteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const afterNote = await tree.getNoteTree(afterNoteTreeId);

    if (!await tree.validateParentChild(res, afterNote.parentNoteId, noteId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change dateModified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE note_tree SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
            [afterNote.parentNoteId, afterNote.notePosition]);

        await sync_table.addNoteReorderingSync(afterNote.parentNoteId, sourceId);

        const noteTree = {
            noteTreeId: utils.newNoteTreeId(),
            noteId: noteId,
            parentNoteId: afterNote.parentNoteId,
            notePosition: afterNote.notePosition + 1,
            isExpanded: 0,
            dateModified: utils.nowDate(),
            isDeleted: 0
        };

        await sql.replace("note_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.noteTreeId, sourceId);
    });

    res.send({ success: true });
}));

module.exports = router;