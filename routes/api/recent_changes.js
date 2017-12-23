"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const recentChanges = await sql.getAll(
        `SELECT 
            notes.is_deleted AS current_is_deleted,
            notes.note_title AS current_note_title,
            notes_history.*
        FROM 
            notes_history
            JOIN notes USING(note_id)
        ORDER BY 
            date_modified_to DESC 
        LIMIT 1000`);

    res.send(recentChanges);
});

module.exports = router;