"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');

async function vacuumDatabase() {
    await sql.execute("VACUUM");

    log.info("Database has been vacuumed.");
}

module.exports = {
    vacuumDatabase
};