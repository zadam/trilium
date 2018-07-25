"use strict";

const sqlInit = require('../../services/sql_init');
const setupService = require('../../services/setup');

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { syncServerHost, syncProxy, username, password } = req.body;

    return await setupService.setupSyncFromSyncServer(syncServerHost, syncProxy, username, password);
}

async function setupSyncFromClient(req) {
    const options = req.body.options;

    await sqlInit.createDatabaseForSync(options);
}

module.exports = {
    setupNewDocument,
    setupSyncFromServer,
    setupSyncFromClient
};