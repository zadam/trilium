const express = require('express');
const router = express.Router();
const sql = require('../sql');
const utils = require('../utils');
const backup = require('../backup');
const auth = require('../auth');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    await backup.regularBackup();

    const notes = await sql.getResults("select "
        + "notes_tree.*, "
        + "COALESCE(clone.note_title, notes.note_title) as note_title, "
        + "notes.note_clone_id, "
        + "notes.encryption, "
        + "case when notes.note_clone_id is null or notes.note_clone_id = '' then 0 else 1 end as is_clone "
        + "from notes_tree "
        + "join notes on notes.note_id = notes_tree.note_id "
        + "left join notes as clone on notes.note_clone_id = clone.note_id "
        + "order by note_pid, note_pos");

    const root_notes = [];
    const notes_map = {};

    for (const note of notes) {
        note['children'] = [];

        if (!note['note_pid']) {
            root_notes.push(note);
        }

        notes_map[note['note_id']] = note
    }

    for (const note of notes) {
        if (note['note_pid'] !== "") {
            const parent = notes_map[note['note_pid']];

            parent['children'].push(note);
            parent['folder'] = true;
        }
    }

    res.send({
        'notes': root_notes,
        'start_note_id': await sql.getOption('start_node'),
        'password_verification_salt': await sql.getOption('password_verification_salt'),
        'password_derived_key_salt': await sql.getOption('password_derived_key_salt'),
        'encrypted_data_key': await sql.getOption('encrypted_data_key'),
        'encryption_session_timeout': await sql.getOption('encryption_session_timeout'),
        'browser_id': utils.randomToken(8),
        'full_load_time': utils.nowTimestamp()
    });
});

module.exports = router;
