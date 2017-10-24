"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;

    const history = await sql.getResults("select * from notes_history where note_id = ? order by date_modified_to desc", [noteId]);

    res.send(history);
});

module.exports = router;