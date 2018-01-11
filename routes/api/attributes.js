"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId/attributes', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    res.send(await sql.getAll("SELECT * FROM attributes WHERE note_id = ? ORDER BY date_created", [noteId]));
}));

module.exports = router;