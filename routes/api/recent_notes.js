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

    await sql.doInTransaction(async () => {
        await sql.replace('recent_notes', {
            note_tree_id: noteTreeId,
            note_path: notePath,
            date_accessed: utils.nowTimestamp(),
            is_deleted: 0
        });

        await sync_table.addRecentNoteSync(noteTreeId);

        await options.setOption('start_note_path', notePath);
    });

    res.send(await getRecentNotes());
});

async function getRecentNotes() {
    await deleteOld();

    return await sql.getResults("SELECT * FROM recent_notes WHERE is_deleted = 0 ORDER BY date_accessed DESC");
}

async function deleteOld() {
    const cutoffDateAccessed = utils.nowTimestamp() - 24 * 60 * 60;

    await sql.doInTransaction(async () => {
        await sql.execute("DELETE FROM recent_notes WHERE date_accessed < ?", [cutoffDateAccessed]);

        await sql.execute("DELETE FROM sync WHERE entity_name = 'recent_notes' AND sync_date < ?", [cutoffDateAccessed]);
    });
}

module.exports = router;