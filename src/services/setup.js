const syncService = require('./sync.js');
const log = require('./log.js');
const sqlInit = require('./sql_init.js');
const optionService = require('./options.js');
const syncOptions = require('./sync_options.js');
const request = require('./request.js');
const appInfo = require('./app_info.js');
const utils = require('./utils.js');
const becca = require('../becca/becca.js');

async function hasSyncServerSchemaAndSeed() {
    const response = await requestToSyncServer('GET', '/api/setup/status');

    if (response.syncVersion !== appInfo.syncVersion) {
        throw new Error(`Could not setup sync since local sync protocol version is ${appInfo.syncVersion} while remote is ${response.syncVersion}. To fix this issue, use same Trilium version on all instances.`);
    }

    return response.schemaExists;
}

function triggerSync() {
    log.info("Triggering sync.");

    // it's ok to not wait for it here
    syncService.sync().then(res => {
        if (res.success) {
            sqlInit.setDbAsInitialized();
        }
    });
}

async function sendSeedToSyncServer() {
    log.info("Initiating sync to server");

    await requestToSyncServer('POST', '/api/setup/sync-seed', {
        options: getSyncSeedOptions(),
        syncVersion: appInfo.syncVersion
    });

    // this is a completely new sync, need to reset counters. If this was not a new sync,
    // the previous request would have failed.
    optionService.setOption('lastSyncedPush', 0);
    optionService.setOption('lastSyncedPull', 0);
}

async function requestToSyncServer(method, path, body = null) {
    const timeout = syncOptions.getSyncTimeout();

    return await utils.timeLimit(request.exec({
        method,
        url: syncOptions.getSyncServerHost() + path,
        body,
        proxy: syncOptions.getSyncProxy(),
        timeout: timeout
    }), timeout);
}

async function setupSyncFromSyncServer(syncServerHost, syncProxy, password) {
    if (sqlInit.isDbInitialized()) {
        return {
            result: 'failure',
            error: 'DB is already initialized.'
        };
    }

    try {
        log.info("Getting document options FROM sync server.");

        // the response is expected to contain documentId and documentSecret options
        const resp = await request.exec({
            method: 'get',
            url: `${syncServerHost}/api/setup/sync-seed`,
            auth: { password },
            proxy: syncProxy,
            timeout: 30000 // seed request should not take long
        });

        if (resp.syncVersion !== appInfo.syncVersion) {
            const message = `Could not setup sync since local sync protocol version is ${appInfo.syncVersion} while remote is ${resp.syncVersion}. To fix this issue, use same Trilium version on all instances.`;

            log.error(message);

            return {
                result: 'failure',
                error: message
            }
        }

        sqlInit.createDatabaseForSync(resp.options, syncServerHost, syncProxy);

        triggerSync();

        return { result: 'success' };
    }
    catch (e) {
        log.error(`Sync failed: '${e.message}', stack: ${e.stack}`);

        return {
            result: 'failure',
            error: e.message
        };
    }
}

function getSyncSeedOptions() {
    return [
        becca.getOption('documentId'),
        becca.getOption('documentSecret')
    ];
}

module.exports = {
    hasSyncServerSchemaAndSeed,
    triggerSync,
    sendSeedToSyncServer,
    setupSyncFromSyncServer,
    getSyncSeedOptions
};
