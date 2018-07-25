const rp = require('request-promise');
const syncService = require('./sync');
const log = require('./log');
const sqlInit = require('./sql_init');

function triggerSync() {
    log.info("Triggering sync.");

    // it's ok to not wait for it here
    syncService.sync().then(async res => {
        if (res.success) {
            await sqlInit.dbInitialized();
        }
    });
}

async function setupSyncFromSyncServer(syncServerHost, syncProxy, username, password) {
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
            uri: syncServerHost + '/api/sync/document',
            auth: {
                'user': username,
                'pass': password
            },
            json: true
        });

        if (syncProxy) {
            options.proxy = syncProxy;
        }

        await sqlInit.createDatabaseForSync(options, syncServerHost, syncProxy);

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