"use strict";

const sql = require('../../services/sql');

async function getEventLog() {
    return await sql.getRows("SELECT * FROM event_log ORDER BY dateCreated DESC");
}

module.exports = {
    getEventLog
};