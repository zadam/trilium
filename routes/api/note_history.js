"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const isProtected = req.query.is_protected;

    let history;

    if (isProtected === undefined) {
        history = await sql.getResults("select * from notes_history where note_id = ? order by date_modified_to desc", [noteId]);
    }
    else {
        history = await sql.getResults("select * from notes_history where note_id = ? and is_protected = ? order by date_modified_to desc", [noteId, is_protected]);
    }

    res.send(history);
});

router.put('', auth.checkApiAuth, async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await sql.replace("notes_history", req.body);

        await sql.addNoteHistorySync(req.body.note_history_id);
    });

    res.send();
});

module.exports = router;