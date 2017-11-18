"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const auth = require('../../services/auth');
const log = require('../../services/log');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');
const notes = require('../../services/notes');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const notes = await sql.getResults("select "
        + "notes_tree.*, "
        + "notes.note_title, "
        + "notes.is_protected "
        + "from notes_tree "
        + "join notes on notes.note_id = notes_tree.note_id "
        + "where notes.is_deleted = 0 and notes_tree.is_deleted = 0 "
        + "order by note_pos");

    const notes_parent = await sql.getResults("" +
        "select parent_id, child_id " +
        "from notes_parent " +
        "join notes_tree as child on child.note_tree_id = notes_parent.child_id " +
        "left join notes_tree as parent on parent.note_tree_id = notes_parent.parent_id " +
        "where child.is_deleted = 0 and (parent.is_deleted = 0 or notes_parent.parent_id = 'root')");

    const dataKey = protected_session.getDataKey(req);

    for (const note of notes) {
        if (note.is_protected) {
            note.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
        }
    }

    res.send({
        notes: notes,
        notes_parent: notes_parent,
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

module.exports = router;
