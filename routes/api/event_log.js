"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');

router.get('', async (req, res, next) => {
    await deleteOld();

    const result = await sql.getResults("SELECT e.id, e.note_id, e.comment, e.date_added, n.note_title " +
        "FROM event_log e LEFT JOIN notes n ON e.note_id = n.note_id ORDER BY date_added DESC");

    res.send(result);
});

async function deleteOld() {
    const cutoffId = await sql.getSingleValue("SELECT id FROM event_log ORDER BY id DESC LIMIT 1000, 1");

    if (cutoffId) {
        await sql.execute("DELETE FROM event_log WHERE id < ?", [cutoffId]);
    }
}

module.exports = router;