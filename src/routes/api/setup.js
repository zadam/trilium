"use strict";

const sqlInit = require('../../services/sql_init');
const setupService = require('../../services/setup');
const log = require('../../services/log');
const appInfo = require('../../services/app_info');

async function getStatus() {
    return {
        isInitialized: await sqlInit.isDbInitialized(),
        schemaExists: await sqlInit.schemaExists(),
        syncVersion: appInfo.syncVersion
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
    const {options, syncVersion} = req.body;

    if (appInfo.syncVersion !== syncVersion) {
        const message = `Could not setup sync since local sync protocol version is ${appInfo.syncVersion} while remote is ${syncVersion}. To fix this issue, use same Trilium version on all instances.`;

        log.error(message);

        return [400, {
            error: message
        }]
    }

    await sqlInit.createDatabaseForSync(options);
}

async function getSyncSeed() {
    log.info("Serving sync seed.");

    return {
        options: await setupService.getSyncSeedOptions(),
        syncVersion: appInfo.syncVersion
    };
}

module.exports = {
    getStatus,
    setupNewDocument,
    setupSyncFromServer,
    getSyncSeed,
    saveSyncSeed
};