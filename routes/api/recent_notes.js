"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const options = require('../../services/options');

router.get('', auth.checkApiAuth, async (req, res, next) => {
    res.send(await getRecentNotes());
});

router.put('/:noteTreeId/:notePath', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const notePath = req.params.notePath;
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await sql.replace('recent_notes', {
            note_tree_id: noteTreeId,
            note_path: notePath,
            date_accessed: utils.nowDate(),
            is_deleted: 0
        });

        await sync_table.addRecentNoteSync(noteTreeId, sourceId);

        await options.setOption('start_note_path', notePath, sourceId);
    });

    res.send(await getRecentNotes());
});

async function getRecentNotes() {
    return await sql.getResults(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN notes_tree USING(note_tree_id)
      WHERE
        recent_notes.is_deleted = 0
        AND notes_tree.is_deleted = 0
      ORDER BY 
        date_accessed DESC`);
}

module.exports = router;