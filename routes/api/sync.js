"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');

router.get('/changed/:since', auth.checkApiAuth, async (req, res, next) => {
    const since = parseInt(req.params.since);

    res.send({
        'syncTimestamp': utils.nowTimestamp(),
        'tree': await sql.getResults("select * from notes_tree where date_modified >= ?", [since]),
        'notes': await sql.getFlattenedResults('note_id', "select note_id from notes where date_modified >= ?", [since]),
        'audit_log': await sql.getResults("select * from audit_log where date_modified >= ?", [since])
    });
});

router.get('/note/:noteId/:since', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const since = parseInt(req.params.since);

    const detail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    res.send({
        'detail': detail,
        'images': await sql.getResults("select * from images where note_id = ? order by note_offset", [noteId]),
        'history': await sql.getResults("select * from notes_history where note_id = ? and date_modified_to >= ?", [noteId, since])
    });
});

module.exports = router;