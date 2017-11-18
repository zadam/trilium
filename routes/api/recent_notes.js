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

router.put('/:noteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;

    await sql.replace('recent_notes', {
        note_tree_id: noteTreeId,
        date_accessed: utils.nowTimestamp(),
        is_deleted: 0
    });

    await sync_table.addRecentNoteSync(noteTreeId);

    await options.setOption('start_note_tree_id', noteTreeId);

    res.send(await getRecentNotes());
});

router.delete('/:noteTreeId', auth.checkApiAuth, async (req, res, next) => {
    await sql.execute('UPDATE recent_notes SET is_deleted = 1 WHERE note_tree_id = ?', [req.params.noteTreeId]);

    await sync_table.addRecentNoteSync(req.params.noteTreeId);

    res.send(await getRecentNotes());
});

async function getRecentNotes() {
    await deleteOld();

    return await sql.getResults("SELECT * FROM recent_notes WHERE is_deleted = 0 ORDER BY date_accessed DESC");
}

async function deleteOld() {
    const cutoffDateAccessed = await sql.getSingleValue("SELECT date_accessed FROM recent_notes WHERE is_deleted = 0 ORDER BY date_accessed DESC LIMIT 100, 1");

    if (cutoffDateAccessed) {
        await sql.execute("DELETE FROM recent_notes WHERE date_accessed < ?", [cutoffDateAccessed]);
    }
}

module.exports = router;