"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('/', auth.checkApiAuth, wrap(async (req, res, next) => {
    const recentChanges = await sql.getRows(
        `SELECT 
            notes.isDeleted AS current_isDeleted,
            notes.title AS current_title,
            note_revisions.*
        FROM 
            note_revisions
            JOIN notes USING(noteId)
        ORDER BY 
            dateModifiedTo DESC 
        LIMIT 1000`);

    res.send(recentChanges);
}));

module.exports = router;