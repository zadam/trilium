"use strict";

const sqlInit = require('../../services/sql_init');
const setupService = require('../../services/setup');
const log = require('../../services/log');

async function getStatus() {
    return {
        isInitialized: await sqlInit.isDbInitialized(),
        schemaExists: await sqlInit.schemaExists()
    };
}

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { syncServerHost, syncProxy, username, password } = req.body;

    return await setupService.setupSyncFromSyncServer(syncServerHost, syncProxy, username, password);
}

async function saveSyncSeed(req) {
    const options = req.body.options;

    await sqlInit.createDatabaseForSync(options);
}

async function getSyncSeed() {
    log.info("Serving sync seed.");

    return await setupService.getSyncSeedOptions();
}

module.exports = {
    getStatus,
    setupNewDocument,
    setupSyncFromServer,
    getSyncSeed,
    saveSyncSeed
};