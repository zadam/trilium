"use strict";

import sql = require('../../services/sql');
import log = require('../../services/log');
import backupService = require('../../services/backup');
import anonymizationService = require('../../services/anonymization');
import consistencyChecksService = require('../../services/consistency_checks');
import { Request } from 'express';
import ValidationError = require('../../errors/validation_error');

function getExistingBackups() {
    return backupService.getExistingBackups();
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

function findAndFixConsistencyIssues() {
    consistencyChecksService.runOnDemandChecks(true);
}

function getExistingAnonymizedDatabases() {
    return anonymizationService.getExistingAnonymizedDatabases();
}

async function anonymize(req: Request) {
    if (req.params.type !== "full" && req.params.type !== "light") {
        throw new ValidationError("Invalid type provided.");
    }
    return await anonymizationService.createAnonymizedCopy(req.params.type);
}

function checkIntegrity() {
    const results = sql.getRows("PRAGMA integrity_check");

    log.info(`Integrity check result: ${JSON.stringify(results)}`);

    return {
        results
    };
}

export = {
    getExistingBackups,
    backupDatabase,
    vacuumDatabase,
    findAndFixConsistencyIssues,
    getExistingAnonymizedDatabases,
    anonymize,
    checkIntegrity
};
