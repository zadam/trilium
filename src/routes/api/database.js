"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
const backupService = require('../../services/backup');
const anonymizationService = require('../../services/anonymization');
const consistencyChecksService = require('../../services/consistency_checks');

async function anonymize(req) {
    return await anonymizationService.createAnonymizedCopy(req.params.type);
}

async function backupDatabase() {
    return {
        backupFile: await backupService.backupNow("now")
    };
}

function vacuumDatabase() {
    sql.execute("VACUUM");

    log.info("Database has been vacuumed.");
}

function checkIntegrity() {
    const results = sql.getRows("PRAGMA integrity_check");

    log.info("Integrity check result: " + JSON.stringify(results));

    return {
        results
    };
}

function findAndFixConsistencyIssues() {
    consistencyChecksService.runOnDemandChecks(true);
}

module.exports = {
    backupDatabase,
    vacuumDatabase,
    findAndFixConsistencyIssues,
    anonymize,
    checkIntegrity
};
