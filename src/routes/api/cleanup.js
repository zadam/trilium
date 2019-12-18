"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
const consistencyChecksService = require('../../services/consistency_checks');

async function vacuumDatabase() {
    await sql.execute("VACUUM");

    log.info("Database has been vacuumed.");
}

async function findAndFixConsistencyIssues() {
    await consistencyChecksService.runOnDemandChecks(true);
}

module.exports = {
    vacuumDatabase,
    findAndFixConsistencyIssues
};