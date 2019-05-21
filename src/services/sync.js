"use strict";

const log = require('./log');
const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const utils = require('./utils');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const syncUpdateService = require('./sync_update');
const contentHashService = require('./content_hash');
const appInfo = require('./app_info');
const syncOptions = require('./sync_options');
const syncMutexService = require('./sync_mutex');
const cls = require('./cls');
const request = require('./request');

let proxyToggle = true;

const stats = {
    outstandingPushes: 0,
    outstandingPulls: 0
};

async function sync() {
    try {
        return await syncMutexService.doExclusively(async () => {
            if (!await syncOptions.isSyncSetup()) {
                return { success: false, message: 'Sync not configured' };
            }

            const syncContext = await login();

            await pushSync(syncContext);

            await pullSync(syncContext);

            await pushSync(syncContext);

            await syncFinished(syncContext);

            await checkContentHash(syncContext);

            return {
                success: true
            };
        });
    }
    catch (e) {
        proxyToggle = !proxyToggle;

        if (e.message &&
                (e.message.includes('ECONNREFUSED') ||
                 e.message.includes('ERR_CONNECTION_REFUSED') ||
                 e.message.includes('Bad Gateway'))) {

            log.info("No connection to sync server.");

            return {
                success: false,
                message: "No connection to sync server."
            };
        }
        else {
            log.info("sync failed: " + e.message + e.stack);

            return {
                success: false,
                message: e.message
            }
        }
    }
}

async function login() {
    const setupService = require('./setup'); // circular dependency issue

    if (!await setupService.hasSyncServerSchemaAndSeed()) {
        await setupService.sendSeedToSyncServer();
    }

    return await doLogin();
}

async function doLogin() {
    const timestamp = dateUtils.utcNowDateTime();

    const documentSecret = await optionService.getOption('documentSecret');
    const hash = utils.hmac(documentSecret, timestamp);

    const syncContext = { cookieJar: {} };

    const resp = await syncRequest(syncContext, 'POST', '/api/login/sync', {
        timestamp: timestamp,
        syncVersion: appInfo.syncVersion,
        hash: hash
    });

    if (sourceIdService.isLocalSourceId(resp.sourceId)) {
        throw new Error(`Sync server has source ID ${resp.sourceId} which is also local. Try restarting sync server.`);
    }

    syncContext.sourceId = resp.sourceId;

    const lastSyncedPull = await getLastSyncedPull();

    // this is important in a scenario where we setup the sync by manually copying the document
    // lastSyncedPull then could be pretty off for the newly cloned client
    if (lastSyncedPull > resp.maxSyncId) {
        log.info(`Lowering last synced pull from ${lastSyncedPull} to ${resp.maxSyncId}`);

        await setLastSyncedPull(resp.maxSyncId);
    }

    return syncContext;
}

async function pullSync(syncContext) {
    while (true) {
        const lastSyncedPull = await getLastSyncedPull();
        const changesUri = '/api/sync/changed?lastSyncId=' + lastSyncedPull;

        const startDate = new Date();

        const resp = await syncRequest(syncContext, 'GET', changesUri);
        stats.outstandingPulls = resp.maxSyncId - lastSyncedPull;

        if (stats.outstandingPulls < 0) {
            stats.outstandingPulls = 0;
        }

        const rows = resp.syncs;

        if (rows.length === 0) {
            break;
        }

        log.info("Pulled " + rows.length + " changes from " + changesUri + " in "
            + (Date.now() - startDate.getTime()) + "ms");

        for (const {sync, entity} of rows) {
            if (!sourceIdService.isLocalSourceId(sync.sourceId)) {
                await syncUpdateService.updateEntity(sync, entity, syncContext.sourceId);
            }

            stats.outstandingPulls = resp.maxSyncId - sync.id;

        }

        await setLastSyncedPull(rows[rows.length - 1].sync.id);
    }

    log.info("Finished pull");
}

async function pushSync(syncContext) {
    let lastSyncedPush = await getLastSyncedPush();

    while (true) {
        const syncs = await sql.getRows('SELECT * FROM sync WHERE id > ? LIMIT 1000', [lastSyncedPush]);

        if (syncs.length === 0) {
            log.info("Nothing to push");

            break;
        }

        const filteredSyncs = syncs.filter(sync => {
            if (sync.sourceId === syncContext.sourceId) {
                // too noisy
                //log.info(`Skipping push #${sync.id} ${sync.entityName} ${sync.entityId} because it originates from sync target`);

                // this may set lastSyncedPush beyond what's actually sent (because of size limit)
                // so this is applied to the database only if there's no actual update
                // TODO: it would be better to simplify this somehow
                lastSyncedPush = sync.id;

                return false;
            }
            else {
                return true;
            }
        });

        if (filteredSyncs.length === 0) {
            // there still might be more syncs (because of batch limit), just all from current batch
            // has been filtered out
            await setLastSyncedPush(lastSyncedPush);

            continue;
        }

        const syncRecords = await getSyncRecords(filteredSyncs);
        const startDate = new Date();

        await syncRequest(syncContext, 'PUT', '/api/sync/update', {
            sourceId: sourceIdService.getCurrentSourceId(),
            entities: syncRecords
        });

        log.info(`Pushing ${syncRecords.length} syncs in ` + (Date.now() - startDate.getTime()) + "ms");

        lastSyncedPush = syncRecords[syncRecords.length - 1].sync.id;

        await setLastSyncedPush(lastSyncedPush);
    }
}

async function syncFinished(syncContext) {
    await syncRequest(syncContext, 'POST', '/api/sync/finished');
}

async function checkContentHash(syncContext) {
    const resp = await syncRequest(syncContext, 'GET', '/api/sync/check');

    if (await getLastSyncedPull() < resp.maxSyncId) {
        log.info("There are some outstanding pulls, skipping content check.");

        return;
    }

    const notPushedSyncs = await sql.getValue("SELECT COUNT(*) FROM sync WHERE id > ?", [await getLastSyncedPush()]);

    if (notPushedSyncs > 0) {
        log.info(`There's ${notPushedSyncs} outstanding pushes, skipping content check.`);

        return;
    }

    await contentHashService.checkContentHashes(resp.hashes);
}

async function syncRequest(syncContext, method, requestPath, body) {
    return await request.exec({
        method,
        url: await syncOptions.getSyncServerHost() + requestPath,
        cookieJar: syncContext.cookieJar,
        timeout: await syncOptions.getSyncTimeout(),
        body,
        proxy: proxyToggle ? await syncOptions.getSyncProxy() : null
    });
}

const primaryKeys = {
    "notes": "noteId",
    "note_contents": "noteId",
    "branches": "branchId",
    "note_revisions": "noteRevisionId",
    "recent_notes": "noteId",
    "api_tokens": "apiTokenId",
    "options": "name",
    "attributes": "attributeId",
    "links": "linkId"
};

async function getEntityRow(entityName, entityId) {
    if (entityName === 'note_reordering') {
        return await sql.getMap("SELECT branchId, notePosition FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [entityId]);
    }
    else {
        const primaryKey = primaryKeys[entityName];

        if (!primaryKey) {
            throw new Error("Unknown entity " + entityName);
        }

        const entity = await sql.getRow(`SELECT * FROM ${entityName} WHERE ${primaryKey} = ?`, [entityId]);

        if (!entity) {
            throw new Error(`Entity ${entityName} ${entityId} not found.`);
        }

        if (['note_contents', 'note_revisions'].includes(entityName) && entity.content !== null) {
            if (typeof entity.content === 'string') {
                entity.content = Buffer.from(entity.content, 'UTF-8');
            }

            entity.content = entity.content.toString("base64");
        }

        return entity;
    }
}

async function getSyncRecords(syncs) {
    const records = [];
    let length = 0;

    for (const sync of syncs) {
        const record = {
            sync: sync,
            entity: await getEntityRow(sync.entityName, sync.entityId)
        };

        records.push(record);

        length += JSON.stringify(record).length;

        if (length > 1000000) {
            break;
        }
    }

    return records;
}

async function getLastSyncedPull() {
    return parseInt(await optionService.getOption('lastSyncedPull'));
}

async function setLastSyncedPull(syncId) {
    await optionService.setOption('lastSyncedPull', syncId);
}

async function getLastSyncedPush() {
    return parseInt(await optionService.getOption('lastSyncedPush'));
}

async function setLastSyncedPush(lastSyncedPush) {
    await optionService.setOption('lastSyncedPush', lastSyncedPush);
}

async function updatePushStats() {
    if (await syncOptions.isSyncSetup()) {
        const lastSyncedPush = await optionService.getOption('lastSyncedPush');

        stats.outstandingPushes = await sql.getValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);
    }
}

sqlInit.dbReady.then(async () => {
    setInterval(cls.wrap(sync), 60000);

    // kickoff initial sync immediately
    setTimeout(cls.wrap(sync), 1000);

    setInterval(cls.wrap(updatePushStats), 1000);
});

module.exports = {
    sync,
    login,
    getSyncRecords,
    stats
};