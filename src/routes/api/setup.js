"use strict";

const sqlInit = require('../../services/sql_init');
const sql = require('../../services/sql');
const rp = require('request-promise');
const Option = require('../../entities/option');
const syncService = require('../../services/sync');
const log = require('../../services/log');

async function setupNewDocument(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

async function setupSyncFromServer(req) {
    const { serverAddress, username, password } = req.body;

    try {
        log.info("Getting document options from sync server.");

        // response is expected to contain documentId and documentSecret options
        const options = await rp.get({
            uri: serverAddress + '/api/sync/document',
            auth: {
                'user': username,
                'pass': password
            },
            json: true
        });

        log.info("Creating database for sync");

        await sql.transactional(async () => {
            await sqlInit.createDatabaseForSync(serverAddress);

            for (const opt of options) {
                await new Option(opt).save();
            }
        });

        log.info("Triggering sync.");

        // it's ok to not wait for it here
        syncService.sync();

        return { result: 'success' };
    }
    catch (e) {
        log.error("Sync failed: " + e.message);

        return {
            result: 'failure',
            error: e.message
        };
    }
}

module.exports = {
    setupNewDocument,
    setupSyncFromServer
};