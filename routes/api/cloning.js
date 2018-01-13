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

    const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    await sql.doInTransaction(async () => {
        const noteTree = {
            note_tree_id: utils.newNoteTreeId(),
            note_id: childNoteId,
            parent_note_id: parentNoteId,
            prefix: prefix,
            note_position: newNotePos,
            is_expanded: 0,
            date_modified: utils.nowDate(),
            is_deleted: 0
        };

        await sql.replace("notes_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.note_tree_id, sourceId);

        await sql.execute("UPDATE notes_tree SET is_expanded = 1 WHERE note_id = ?", [parentNoteId]);
    });

    res.send({ success: true });
}));

router.put('/:noteId/clone-after/:afterNoteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const afterNote = await tree.getNoteTree(afterNoteTreeId);

    if (!await tree.validateParentChild(res, afterNote.parent_note_id, noteId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position > ? AND is_deleted = 0",
            [afterNote.parent_note_id, afterNote.note_position]);

        await sync_table.addNoteReorderingSync(afterNote.parent_note_id, sourceId);

        const noteTree = {
            note_tree_id: utils.newNoteTreeId(),
            note_id: noteId,
            parent_note_id: afterNote.parent_note_id,
            note_position: afterNote.note_position + 1,
            is_expanded: 0,
            date_modified: utils.nowDate(),
            is_deleted: 0
        };

        await sql.replace("notes_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.note_tree_id, sourceId);
    });

    res.send({ success: true });
}));

module.exports = router;