"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const data_encryption = require('../../services/data_encryption');
const protected_session = require('../../services/protected_session');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const history = await sql.getResults("select * from notes_history where note_id = ? order by date_modified_to desc", [noteId]);

    const dataKey = protected_session.getDataKey(req);

    for (const hist of history) {
        if (hist.is_protected) {
            hist.note_title = data_encryption.decrypt(dataKey, hist.note_title);
            hist.note_text = data_encryption.decrypt(dataKey, hist.note_text);
        }
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