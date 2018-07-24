const sqlInit = require('./sql_init');
const sql = require('./sql');
const rp = require('request-promise');
const Option = require('../entities/option');
const syncService = require('./sync');
const log = require('./log');
const optionService = require('./options');

function triggerSync() {
// it's ok to not wait for it here
    syncService.sync().then(async () => {
        await optionService.setOption('initialized', 'true');
    });
}

async function setupSyncFromSyncServer(serverAddress, username, password) {
    if (await sqlInit.isDbInitialized()) {
        return {
            result: 'failure',
            error: 'DB is already initialized.'
        };
    }

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

        triggerSync();

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
    setupSyncFromSyncServer,
    triggerSync
};