"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const auth = require('../../services/auth');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');
const notes = require('../../services/notes');
const sync_table = require('../../services/sync_table');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const notes = await sql.getResults("select "
        + "notes_tree.*, "
        + "notes.note_title, "
        + "notes.is_protected "
        + "from notes_tree "
        + "join notes on notes.note_id = notes_tree.note_id "
        + "where notes.is_deleted = 0 and notes_tree.is_deleted = 0 "
        + "order by note_pos");

    const dataKey = protected_session.getDataKey(req);

    for (const note of notes) {
        if (note.is_protected) {
            note.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
        }
    }

    res.send({
        notes: notes,
        start_note_tree_id: await options.getOption('start_note_tree_id'),
        tree_load_time: utils.nowTimestamp()
    });
});

router.put('/:noteId/protectSubTree/:isProtected', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const isProtected = !!parseInt(req.params.isProtected);
    const dataKey = protected_session.getDataKey(req);

    await sql.doInTransaction(async () => {
        await notes.protectNoteRecursively(noteId, dataKey, isProtected);
    });

    res.send({});
});

router.put('/:parentNoteId/addChild/:childNoteId', auth.checkApiAuth, async (req, res, next) => {
    const parentNoteId = req.params.parentNoteId;
    const childNoteId = req.params.childNoteId;

    const existing = await sql.getSingleValue('select * from notes_tree where note_id = ? and note_pid = ?', [childNoteId, parentNoteId]);

    if (!existing) {
        const maxNotePos = await sql.getSingleValue('select max(note_pos) from notes_tree where note_pid = ? and is_deleted = 0', [parentNoteId]);
        const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

        const noteTreeId = utils.newNoteTreeId();

        await sql.doInTransaction(async () => {
            await sync_table.addNoteTreeSync(noteTreeId);

            await sql.insert("notes_tree", {
                'note_tree_id': noteTreeId,
                'note_id': childNoteId,
                'note_pid': parentNoteId,
                'note_pos': newNotePos,
                'is_expanded': 0,
                'date_modified': utils.nowTimestamp(),
                'is_deleted': 0
            });
        });
    }
    else if (existing && existing.is_deleted) {
        await sql.execute("UPDATE notes_tree SET is_deleted = 0 WHERE note_tree_id = ?", [existing.note_tree_id]);
    }

    res.send({});
});

module.exports = router;
