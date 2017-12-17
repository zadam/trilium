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
    const notes = await sql.getResults("SELECT "
        + "notes_tree.*, "
        + "notes.note_title, "
        + "notes.is_protected "
        + "FROM notes_tree "
        + "JOIN notes ON notes.note_id = notes_tree.note_id "
        + "WHERE notes.is_deleted = 0 AND notes_tree.is_deleted = 0 "
        + "ORDER BY note_pos");

    const dataKey = protected_session.getDataKey(req);

    for (const note of notes) {
        if (note.is_protected) {
            note.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
        }
    }

    res.send({
        notes: notes,
        start_note_path: await options.getOption('start_note_path')
    });
});

router.put('/:noteId/protect-sub-tree/:isProtected', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const isProtected = !!parseInt(req.params.isProtected);
    const dataKey = protected_session.getDataKey(req);
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await notes.protectNoteRecursively(noteId, dataKey, isProtected, sourceId);
    });

    res.send({});
});

router.put('/:noteTreeId/set-prefix', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const sourceId = req.headers.source_id;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET prefix = ?, date_modified = ? WHERE note_tree_id = ?", [prefix, utils.nowDate(), noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({});
});

module.exports = router;
