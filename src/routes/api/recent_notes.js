"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const options = require('../../services/options');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkApiAuth, wrap(async (req, res, next) => {
    res.send(await getRecentNotes());
}));

router.put('/:noteTreeId/:notePath', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const notePath = req.params.notePath;
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await sql.replace('recent_notes', {
            noteTreeId: noteTreeId,
            notePath: notePath,
            dateAccessed: utils.nowDate(),
            isDeleted: 0
        });

        await sync_table.addRecentNoteSync(noteTreeId, sourceId);

        await options.setOption('start_note_path', notePath, sourceId);
    });

    res.send(await getRecentNotes());
}));

async function getRecentNotes() {
    return await sql.getRows(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN note_tree USING(noteTreeId)
      WHERE
        recent_notes.isDeleted = 0
        AND note_tree.isDeleted = 0
      ORDER BY 
        dateAccessed DESC`);
}

module.exports = router;