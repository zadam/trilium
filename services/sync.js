"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const sourceId = require('./sourceId');
const notes = require('./notes');
const syncUpdate = require('./sync_update');
const content_hash = require('./content_hash');
const event_log = require('./event_log');
const fs = require('fs');
const app_info = require('./app_info');
const messaging = require('./messaging');
const sync_setup = require('./sync_setup');
const sync_mutex = require('./sync_mutex');

let proxyToggle = true;
let syncServerCertificate = null;

async function sync() {
    try {
        await sync_mutex.doExclusively(async () => {
            if (!await sql.isDbUpToDate()) {
                return {
                    success: false,
                    message: "DB not up to date"
                };
            }

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
    const timestamp = utils.nowDate();

    const documentSecret = await options.getOption('document_secret');
    const hash = utils.hmac(documentSecret, timestamp);

    const syncContext = { cookieJar: rp.jar() };

    const resp = await syncRequest(syncContext, 'POST', '/api/login/sync', {
        timestamp: timestamp,
        dbVersion: app_info.db_version,
        hash: hash
    });

    if (sourceId.isLocalSourceId(resp.sourceId)) {
        throw new Error(`Sync server has source ID ${resp.sourceId} which is also local. Try restarting sync server.`);
    }

    syncContext.sourceId = resp.sourceId;

    return syncContext;
}

async function getLastSyncedPull() {
    return parseInt(await options.getOption('last_synced_pull'));
}

async function setLastSyncedPull(syncId) {
    await sql.doInTransaction(async () => {
        await options.setOption('last_synced_pull', syncId);
    });
}

async function pullSync(syncContext) {
    const lastSyncedPull = await getLastSyncedPull();

    const changesUri = '/api/sync/changed?lastSyncId=' + lastSyncedPull;

    const syncRows = await syncRequest(syncContext, 'GET', changesUri);

    log.info("Pulled " + syncRows.length + " changes from " + changesUri);

    for (const sync of syncRows) {
        if (sourceId.isLocalSourceId(sync.sourceId)) {
            log.info(`Skipping pull #${sync.id} ${sync.entityName} ${sync.entityId} because ${sync.sourceId} is a local source id.`);

            await setLastSyncedPull(sync.id);

            continue;
        }

        const resp = await syncRequest(syncContext, 'GET', "/api/sync/" + sync.entityName + "/" + encodeURIComponent(sync.entityId));

        if (!resp || (sync.entityName === 'notes' && !resp.entity)) {
            log.error(`Empty response to pull for sync #${sync.id} ${sync.entityName}, id=${sync.entityId}`);
        }
        else if (sync.entityName === 'notes') {
            await syncUpdate.updateNote(resp.entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'notes_tree') {
            await syncUpdate.updateNoteTree(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'notes_history') {
            await syncUpdate.updateNoteHistory(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'notes_reordering') {
            await syncUpdate.updateNoteReordering(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'options') {
            await syncUpdate.updateOptions(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'recent_notes') {
            await syncUpdate.updateRecentNotes(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'images') {
            await syncUpdate.updateImage(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'notes_image') {
            await syncUpdate.updateNoteImage(resp, syncContext.sourceId);
        }
        else if (sync.entityName === 'attributes') {
            await syncUpdate.updateAttribute(resp, syncContext.sourceId);
        }
        else {
            throw new Error(`Unrecognized entity type ${sync.entityName} in sync #${sync.id}`);
        }

        await setLastSyncedPull(sync.id);
    }

    log.info("Finished pull");
}

async function getLastSyncedPush() {
    return parseInt(await options.getOption('last_synced_push'));
}

async function setLastSyncedPush(lastSyncedPush) {
    await sql.doInTransaction(async () => {
        await options.setOption('last_synced_push', lastSyncedPush);
    });
}

async function pushSync(syncContext) {
    let lastSyncedPush = await getLastSyncedPush();

    while (true) {
        const sync = await sql.getFirstOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

        if (sync === null) {
            // nothing to sync

            log.info("Nothing to push");

            break;
        }

        if (sync.sourceId === syncContext.sourceId) {
            log.info(`Skipping push #${sync.id} ${sync.entityName} ${sync.entityId} because it originates from sync target`);
        }
        else {
            await pushEntity(sync, syncContext);
        }

        lastSyncedPush = sync.id;

        await setLastSyncedPush(lastSyncedPush);
    }
}

async function pushEntity(sync, syncContext) {
    let entity;

    if (sync.entityName === 'notes') {
        entity = await sql.getFirst('SELECT * FROM notes WHERE noteId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'notes_tree') {
        entity = await sql.getFirst('SELECT * FROM notes_tree WHERE noteTreeId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'notes_history') {
        entity = await sql.getFirst('SELECT * FROM notes_history WHERE noteHistoryId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'notes_reordering') {
        entity = {
            parentNoteId: sync.entityId,
            ordering: await sql.getMap('SELECT noteTreeId, notePosition FROM notes_tree WHERE parentNoteId = ? AND isDeleted = 0', [sync.entityId])
        };
    }
    else if (sync.entityName === 'options') {
        entity = await sql.getFirst('SELECT * FROM options WHERE name = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'recent_notes') {
        entity = await sql.getFirst('SELECT * FROM recent_notes WHERE noteTreeId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'images') {
        entity = await sql.getFirst('SELECT * FROM images WHERE imageId = ?', [sync.entityId]);

        if (entity.data !== null) {
            entity.data = entity.data.toString('base64');
        }
    }
    else if (sync.entityName === 'notes_image') {
        entity = await sql.getFirst('SELECT * FROM notes_image WHERE noteImageId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'attributes') {
        entity = await sql.getFirst('SELECT * FROM attributes WHERE attributeId = ?', [sync.entityId]);
    }
    else {
        throw new Error(`Unrecognized entity type ${sync.entityName} in sync #${sync.id}`);
    }

    if (!entity) {
        log.info(`Sync #${sync.id} entity for ${sync.entityName} ${sync.entityId} doesn't exist. Skipping.`);
        return;
    }

    log.info(`Pushing changes in sync #${sync.id} ${sync.entityName} ${sync.entityId}`);

    const payload = {
        sourceId: sourceId.getCurrentSourceId(),
        entity: entity
    };

    await syncRequest(syncContext, 'PUT', '/api/sync/' + sync.entityName, payload);
}

async function checkContentHash(syncContext) {
    const resp = await syncRequest(syncContext, 'GET', '/api/sync/check');

    if (await getLastSyncedPull() < resp.max_sync_id) {
        log.info("There are some outstanding pulls, skipping content check.");

        return;
    }

    const lastSyncedPush = await getLastSyncedPush();
    const notPushedSyncs = await sql.getFirstValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    if (notPushedSyncs > 0) {
        log.info("There's " + notPushedSyncs + " outstanding pushes, skipping content check.");

        return;
    }

    const hashes = await content_hash.getHashes();
    let allChecksPassed = true;

    for (const key in hashes) {
        if (hashes[key] !== resp.hashes[key]) {
            allChecksPassed = false;

            await event_log.addEvent(`Content hash check for ${key} FAILED. Local is ${hashes[key]}, remote is ${resp.hashes[key]}`);

            if (key !== 'recent_notes') {
                // let's not get alarmed about recent notes which get updated often and can cause failures in race conditions
                await messaging.sendMessageToAllClients({type: 'sync-hash-check-failed'});
            }
        }
    }

    if (allChecksPassed) {
        log.info("Content hash checks PASSED");
    }
}

async function syncRequest(syncContext, method, uri, body) {
    const fullUri = sync_setup.SYNC_SERVER + uri;

    try {
        const options = {
            method: method,
            uri: fullUri,
            jar: syncContext.cookieJar,
            json: true,
            body: body,
            timeout: sync_setup.SYNC_TIMEOUT
        };

        if (syncServerCertificate) {
            options.ca = syncServerCertificate;
        }

        if (sync_setup.SYNC_PROXY && proxyToggle) {
            options.proxy = sync_setup.SYNC_PROXY;
        }

        return await rp(options);
    }
    catch (e) {
        throw new Error(`Request to ${method} ${fullUri} failed, inner exception: ${e.stack}`);
    }
}

sql.dbReady.then(() => {
    if (sync_setup.isSyncSetup) {
        log.info("Setting up sync to " + sync_setup.SYNC_SERVER + " with timeout " + sync_setup.SYNC_TIMEOUT);

        if (sync_setup.SYNC_PROXY) {
            log.info("Sync proxy: " + sync_setup.SYNC_PROXY);
        }

        if (sync_setup.SYNC_CERT_PATH) {
            log.info('Sync certificate: ' + sync_setup.SYNC_CERT_PATH);

            syncServerCertificate = fs.readFileSync(sync_setup.SYNC_CERT_PATH);
        }

        setInterval(sync, 60000);

        // kickoff initial sync immediately
        setTimeout(sync, 1000);
    }
    else {
        log.info("Sync server not configured, sync timer not running.")
    }
});

module.exports = {
    sync
};