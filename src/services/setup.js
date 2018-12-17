const syncService = require('./sync');
const log = require('./log');
const sqlInit = require('./sql_init');
const repository = require('./repository');
const optionService = require('./options');
const syncOptions = require('./sync_options');
const request = require('./request');

async function hasSyncServerSchemaAndSeed() {
    const response = await requestToSyncServer('GET', '/api/setup/status');

    return response.schemaExists;
}

function triggerSync() {
    log.info("Triggering sync.");

    // it's ok to not wait for it here
    syncService.sync().then(async res => {
        if (res.success) {
            await sqlInit.dbInitialized();
        }
    });
}

async function sendSeedToSyncServer() {
    log.info("Initiating sync to server");

    await requestToSyncServer('POST', '/api/setup/sync-seed', {
        options: await getSyncSeedOptions()
    });

    // this is completely new sync, need to reset counters. If this would not be new sync,
    // the previous request would have failed.
    await optionService.setOption('lastSyncedPush', 0);
    await optionService.setOption('lastSyncedPull', 0);
}

async function requestToSyncServer(method, path, body = null) {
    return await request.exec({
        method,
        url: await syncOptions.getSyncServerHost() + path,
        body,
        proxy: await syncOptions.getSyncProxy(),
        timeout: await syncOptions.getSyncTimeout()
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
        const options = await request.exec({
            method: 'get',
            url: syncServerHost + '/api/setup/sync-seed',
            auth: {
                'user': username,
                'pass': password
            },
            proxy: syncProxy
        });

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

async function getSyncSeedOptions() {
    return [
        await repository.getOption('documentId'),
        await repository.getOption('documentSecret')
    ];
}

module.exports = {
    hasSyncServerSchemaAndSeed,
    triggerSync,
    sendSeedToSyncServer,
    setupSyncFromSyncServer,
    getSyncSeedOptions
};