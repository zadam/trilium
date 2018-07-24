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

module.exports = {
    setupNewDocument,
    setupSyncFromServer
};