"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const tree = require('../../services/tree');
const wrap = require('express-promise-wrap').wrap;

/**
 * Code in this file deals with moving and cloning note tree rows. Relationship between note and parent note is unique
 * for not deleted note trees. There may be multiple deleted note-parent note relationships.
 */

router.put('/:noteTreeId/move-to/:parentNoteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const parentNoteId = req.params.parentNoteId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getNoteTree(noteTreeId);

    if (!await tree.validateParentChild(res, parentNoteId, noteToMove.note_id, noteTreeId)) {
        return;
    }

    const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [parentNoteId, newNotePos, now, noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:noteTreeId/move-before/:beforeNoteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const beforeNoteTreeId = req.params.beforeNoteTreeId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getNoteTree(noteTreeId);
    const beforeNote = await tree.getNoteTree(beforeNoteTreeId);

    if (!await tree.validateParentChild(res, beforeNote.parent_note_id, noteToMove.note_id, noteTreeId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position >= ? AND is_deleted = 0",
            [beforeNote.parent_note_id, beforeNote.note_position]);

        await sync_table.addNoteReorderingSync(beforeNote.parent_note_id, sourceId);

        const now = utils.nowDate();

        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [beforeNote.parent_note_id, beforeNote.note_position, now, noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:noteTreeId/move-after/:afterNoteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const noteToMove = await tree.getNoteTree(noteTreeId);
    const afterNote = await tree.getNoteTree(afterNoteTreeId);

    if (!await tree.validateParentChild(res, afterNote.parent_note_id, noteToMove.note_id, noteTreeId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position > ? AND is_deleted = 0",
            [afterNote.parent_note_id, afterNote.note_position]);

        await sync_table.addNoteReorderingSync(afterNote.parent_note_id, sourceId);

        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [afterNote.parent_note_id, afterNote.note_position + 1, utils.nowDate(), noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
}));

router.put('/:noteTreeId/expanded/:expanded', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const expanded = req.params.expanded;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET is_expanded = ? WHERE note_tree_id = ?", [expanded, noteTreeId]);

        // we don't sync expanded attribute
    });

    res.send({});
}));

router.delete('/:noteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await notes.deleteNote(req.params.noteTreeId, req.headers.source_id);
    });

    res.send({});
}));

module.exports = router;