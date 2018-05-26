"use strict";

const sql = require('../../services/sql');

async function getEventLog() {
    await deleteOld();

    return await sql.getRows("SELECT * FROM event_log ORDER BY dateCreated DESC");
}

async function deleteOld() {
    const cutoffId = await sql.getValue("SELECT id FROM event_log ORDER BY id DESC LIMIT 1000, 1");

    if (cutoffId) {
        await sql.execute("DELETE FROM event_log WHERE id < ?", [cutoffId]);
    }
}

module.exports = {
    getEventLog
};