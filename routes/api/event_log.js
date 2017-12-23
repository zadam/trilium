"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('', auth.checkApiAuth, async (req, res, next) => {
    await deleteOld();

    const result = await sql.getResults("SELECT * FROM event_log ORDER BY date_added DESC");

    res.send(result);
});

async function deleteOld() {
    const cutoffId = await sql.getSingleValue("SELECT id FROM event_log ORDER BY id DESC LIMIT 1000, 1");

    if (cutoffId) {
        await sql.doInTransaction(async () => {
            await sql.execute("DELETE FROM event_log WHERE id < ?", [cutoffId]);
        });
    }
}

module.exports = router;