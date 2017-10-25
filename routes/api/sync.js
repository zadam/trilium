"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/changed/:since', auth.checkApiAuth, async (req, res, next) => {
    const since = parseInt(req.params.since);

    res.send({
        'tree': await sql.getResults("select * from notes_tree where date_modified >= ?", [since]),
        'notes': await sql.getFlattenedResults('note_id', "select note_id from notes where date_modified >= ?", [since])
    });
});

module.exports = router;