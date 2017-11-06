"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const auth = require('../../services/auth');
const log = require('../../services/log');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const notes = await sql.getResults("select "
        + "notes_tree.*, "
        + "COALESCE(clone.note_title, notes.note_title) as note_title, "
        + "notes.note_clone_id, "
        + "notes.encryption, "
        + "case when notes.note_clone_id is null or notes.note_clone_id = '' then 0 else 1 end as is_clone "
        + "from notes_tree "
        + "join notes on notes.note_id = notes_tree.note_id "
        + "left join notes as clone on notes.note_clone_id = clone.note_id "
        + "where notes.is_deleted = 0 and notes_tree.is_deleted = 0 "
        + "order by note_pid, note_pos");

    const root_notes = [];
    const notes_map = {};

    for (const note of notes) {
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
        password_verification_salt: await options.getOption('password_verification_salt'),
        password_derived_key_salt: await options.getOption('password_derived_key_salt'),
        encrypted_data_key: await options.getOption('encrypted_data_key'),
        encryption_session_timeout: await options.getOption('encryption_session_timeout'),
        browser_id: utils.randomString(12),
        tree_load_time: utils.nowTimestamp()
    });
});

module.exports = router;
