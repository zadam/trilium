"use strict";

const sqlInit = require('../../services/sql_init');
const setupService = require('../../services/setup');

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { serverAddress, username, password } = req.body;

    return await setupService.setupSyncFromSyncServer(serverAddress, username, password);
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