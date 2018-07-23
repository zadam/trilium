"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const utils = require('./utils');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const syncUpdateService = require('./sync_update');
const contentHashService = require('./content_hash');
const fs = require('fs');
const appInfo = require('./app_info');
const syncSetup = require('./sync_setup');
const syncMutexService = require('./sync_mutex');
const cls = require('./cls');

let proxyToggle = true;

async function sync() {
    try {
        await syncMutexService.doExclusively(async () => {
            const syncContext = await login();

            await pushSync(syncContext);

            await pullSync(syncContext);

            await pushSync(syncContext);

            await checkContentHash(syncContext);
        });

        return {
            success: true
        };
    }
    catch (e) {
        proxyToggle = !proxyToggle;

        if (e.message.indexOf('ECONNREFUSED') !== -1) {
            log.info("No connection to sync server.");

            return {
                success: false,
                message: "No connection to sync server."
            };
        }
        else {
            log.info("sync failed: " + e.stack);

            return {
                success: false,
                message: e.message
            }
        }
    }
}

async function login() {
    const timestamp = dateUtils.nowDate();

    const documentSecret = await optionService.getOption('documentSecret');
    const hash = utils.hmac(documentSecret, timestamp);

    const syncContext = { cookieJar: rp.jar() };

    const resp = await syncRequest(syncContext, 'POST', '/api/login/sync', {
        timestamp: timestamp,
        syncVersion: appInfo.syncVersion,
        hash: hash
    });

    if (sourceIdService.isLocalSourceId(resp.sourceId)) {
        throw new Error(`Sync server has source ID ${resp.sourceId} which is also local. Try restarting sync server.`);
    }

    syncContext.sourceId = resp.sourceId;

    return syncContext;
}

async function pullSync(syncContext) {
    const changesUri = '/api/sync/changed?lastSyncId=' + await getLastSyncedPull();

    const rows = await syncRequest(syncContext, 'GET', changesUri);

    log.info("Pulled " + rows.length + " changes from " + changesUri);

    for (const {sync, entity} of rows) {
        if (sourceIdService.isLocalSourceId(sync.sourceId)) {
            log.info(`Skipping pull #${sync.id} ${sync.entityName} ${sync.entityId} because ${sync.sourceId} is a local source id.`);
        }
        else {
            await syncUpdateService.updateEntity(sync, entity, syncContext.sourceId);
        }

        await setLastSyncedPull(sync.id);
    }

    log.info("Finished pull");
}

async function pushSync(syncContext) {
    let lastSyncedPush = await getLastSyncedPush();

    while (true) {
        const syncs = await sql.getRows('SELECT * FROM sync WHERE id > ? LIMIT 1000', [lastSyncedPush]);

        const filteredSyncs = syncs.filter(sync => {
            if (sync.sourceId === syncContext.sourceId) {
                log.info(`Skipping push #${sync.id} ${sync.entityName} ${sync.entityId} because it originates from sync target`);

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
            log.info("Nothing to push");

            await setLastSyncedPush(lastSyncedPush);

            break;
        }

        const syncRecords = await getSyncRecords(filteredSyncs);

        log.info(`Pushing ${syncRecords.length} syncs.`);

        await syncRequest(syncContext, 'PUT', '/api/sync/update', {
            sourceId: sourceIdService.getCurrentSourceId(),
            entities: syncRecords
        });

        lastSyncedPush = syncRecords[syncRecords.length - 1].sync.id;

        await setLastSyncedPush(lastSyncedPush);
    }
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

async function syncRequest(syncContext, method, uri, body) {
    const fullUri = await syncSetup.getSyncServer() + uri;

    try {
        const options = {
            method: method,
            uri: fullUri,
            jar: syncContext.cookieJar,
            json: true,
            body: body,
            timeout: await syncSetup.getSyncTimeout()
        };

        const syncProxy = await syncSetup.getSyncProxy();

        if (syncProxy && proxyToggle) {
            options.proxy = syncProxy;
        }

        return await rp(options);
    }
    catch (e) {
        throw new Error(`Request to ${method} ${fullUri} failed, inner exception: ${e.stack}`);
    }
}

const primaryKeys = {
    "notes": "noteId",
    "branches": "branchId",
    "note_revisions": "noteRevisionId",
    "recent_notes": "branchId",
    "images": "imageId",
    "note_images": "noteImageId",
    "labels": "labelId",
    "api_tokens": "apiTokenId",
    "options": "name"
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

        if (entityName === 'notes' && entity.type === 'file') {
            entity.content = entity.content.toString("binary");
        }
        else if (entityName === 'images') {
            entity.data = entity.data.toString('base64');
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

sqlInit.dbReady.then(async () => {
    if (await syncSetup.isSyncSetup()) {
        log.info("Setting up sync to " + await syncSetup.getSyncServer() + " with timeout " + await syncSetup.getSyncTimeout());

        const syncProxy = await syncSetup.getSyncProxy();

        if (syncProxy) {
            log.info("Sync proxy: " + syncProxy);
        }

        setInterval(cls.wrap(sync), 60000);

        // kickoff initial sync immediately
        setTimeout(cls.wrap(sync), 1000);
    }
    else {
        log.info("Sync server not configured, sync timer not running.")
    }
});

module.exports = {
    sync,
    login,
    getSyncRecords
};