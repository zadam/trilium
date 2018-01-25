"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const protected_session = require('../../services/protected_session');
const sync_table = require('../../services/sync_table');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const history = await sql.getAll("SELECT * FROM notes_history WHERE note_id = ? order by date_modified_to desc", [noteId]);
    protected_session.decryptNoteHistoryRows(req, history);

    res.send(history);
}));

router.put('', auth.checkApiAuth, wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await sql.replace("notes_history", req.body);

        await sync_table.addNoteHistorySync(req.body.note_history_id, sourceId);
    });

    res.send();
}));

module.exports = router;