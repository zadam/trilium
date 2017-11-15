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
        + "order by note_pid, note_pos");

    const root_notes = [];
    const notes_map = {};

    const dataKey = protected_session.getDataKey(req);

    for (const note of notes) {
        if (note.is_protected) {
            note.note_title = data_encryption.decrypt(dataKey, note.note_title);
        }

        note.children = [];

        if (!note.note_pid) {
            root_notes.push(note);
        }

        notes_map[note.note_id] = note;
    }

    for (const note of notes) {
        if (note.note_pid !== "") {
            const parent = notes_map[note.note_pid];

            if (!parent) {
                log.error("Parent " + note.note_pid + ' has not been found');
                continue;
            }
            parent.children.push(note);
            parent.folder = true;
        }
    }

    res.send({
        notes: root_notes,
        start_note_id: await options.getOption('start_node'),
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
