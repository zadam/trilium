"use strict";

const sqlInit = require('../../services/sql_init');
const setupService = require('../../services/setup');
const optionService = require('../../services/options');
const syncService = require('../../services/sync');
const log = require('../../services/log');
const rp = require('request-promise');

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { syncServerHost, syncProxy, username, password } = req.body;

    return await setupService.setupSyncFromSyncServer(syncServerHost, syncProxy, username, password);
}

async function setupSyncToSyncServer() {
    log.info("Initiating sync to server");

    const syncServerHost = await optionService.getOption('syncServerHost');
    const syncProxy = await optionService.getOption('syncProxy');

    const rpOpts = {
        uri: syncServerHost + '/api/setup/sync-seed',
        method: 'POST',
        json: true,
        body: {
            options: await setupService.getSyncSeedOptions()
        }
    };

    if (syncProxy) {
        rpOpts.proxy = syncProxy;
    }

    try {
        await rp(rpOpts);
    }
    catch (e) {
        return { success: false, error: e.message };
    }

    // this is completely new sync, need to reset counters. If this would not be new sync,
    // the previous request would have failed.
    await optionService.setOption('lastSyncedPush', 0);
    await optionService.setOption('lastSyncedPull', 0);

    syncService.sync();

    return { success: true };
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
    setupNewDocument,
    setupSyncFromServer,
    setupSyncToSyncServer,
    getSyncSeed,
    saveSyncSeed
};