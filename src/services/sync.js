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
const eventLogService = require('./event_log');
const fs = require('fs');
const appInfo = require('./app_info');
const messagingService = require('./messaging');
const syncSetup = require('./sync_setup');
const syncMutexService = require('./sync_mutex');
const cls = require('./cls');

let proxyToggle = true;
let syncServerCertificate = null;

async function sync() {
    try {
        await syncMutexService.doExclusively(async () => {
            if (!await sqlInit.isDbUpToDate()) {
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
    const timestamp = dateUtils.nowDate();

    const documentSecret = await optionService.getOption('documentSecret');
    const hash = utils.hmac(documentSecret, timestamp);

    const syncContext = { cookieJar: rp.jar() };

    const resp = await syncRequest(syncContext, 'POST', '/api/login/sync', {
        timestamp: timestamp,
        dbVersion: appInfo.dbVersion,
        hash: hash
    });

    if (sourceIdService.isLocalSourceId(resp.sourceId)) {
        throw new Error(`Sync server has source ID ${resp.sourceId} which is also local. Try restarting sync server.`);
    }

    syncContext.sourceId = resp.sourceId;

    return syncContext;
}

async function getLastSyncedPull() {
    return parseInt(await optionService.getOption('lastSyncedPull'));
}

async function setLastSyncedPull(syncId) {
    await optionService.setOption('lastSyncedPull', syncId);
}

async function pullSync(syncContext) {
    const lastSyncedPull = await getLastSyncedPull();

    const changesUri = '/api/sync/changed?lastSyncId=' + lastSyncedPull;

    const rows = await syncRequest(syncContext, 'GET', changesUri);

    log.info("Pulled " + rows.length + " changes from " + changesUri);

    for (const {sync, entity} of rows) {
        if (sourceIdService.isLocalSourceId(sync.sourceId)) {
            log.info(`Skipping pull #${sync.id} ${sync.entityName} ${sync.entityId} because ${sync.sourceId} is a local source id.`);

            await setLastSyncedPull(sync.id);

            continue;
        }

        if (!entity) {
            log.error(`Empty response to pull for sync #${sync.id} ${sync.entityName}, id=${sync.entityId}`);
        }
        else if (sync.entityName === 'notes') {
            await syncUpdateService.updateNote(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'branches') {
            await syncUpdateService.updateBranch(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'note_revisions') {
            await syncUpdateService.updateNoteRevision(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'note_reordering') {
            await syncUpdateService.updateNoteReordering(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'options') {
            await syncUpdateService.updateOptions(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'recent_notes') {
            await syncUpdateService.updateRecentNotes(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'images') {
            await syncUpdateService.updateImage(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'note_images') {
            await syncUpdateService.updateNoteImage(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'labels') {
            await syncUpdateService.updateLabel(entity, syncContext.sourceId);
        }
        else if (sync.entityName === 'api_tokens') {
            await syncUpdateService.updateApiToken(entity, syncContext.sourceId);
        }
        else {
            throw new Error(`Unrecognized entity type ${sync.entityName} in sync #${sync.id}`);
        }

        await setLastSyncedPull(sync.id);
    }

    log.info("Finished pull");
}

async function getLastSyncedPush() {
    return parseInt(await optionService.getOption('lastSyncedPush'));
}

async function setLastSyncedPush(lastSyncedPush) {
    await optionService.setOption('lastSyncedPush', lastSyncedPush);
}

async function pushSync(syncContext) {
    let lastSyncedPush = await getLastSyncedPush();

    while (true) {
        const sync = await sql.getRowOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

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
        entity = await sql.getRow('SELECT * FROM notes WHERE noteId = ?', [sync.entityId]);

        serializeNoteContentBuffer(entity);
    }
    else if (sync.entityName === 'branches') {
        entity = await sql.getRow('SELECT * FROM branches WHERE branchId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'note_revisions') {
        entity = await sql.getRow('SELECT * FROM note_revisions WHERE noteRevisionId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'note_reordering') {
        entity = {
            parentNoteId: sync.entityId,
            ordering: await sql.getMap('SELECT branchId, notePosition FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [sync.entityId])
        };
    }
    else if (sync.entityName === 'options') {
        entity = await sql.getRow('SELECT * FROM options WHERE name = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'recent_notes') {
        entity = await sql.getRow('SELECT * FROM recent_notes WHERE branchId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'images') {
        entity = await sql.getRow('SELECT * FROM images WHERE imageId = ?', [sync.entityId]);

        if (entity.data !== null) {
            entity.data = entity.data.toString('base64');
        }
    }
    else if (sync.entityName === 'note_images') {
        entity = await sql.getRow('SELECT * FROM note_images WHERE noteImageId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'labels') {
        entity = await sql.getRow('SELECT * FROM labels WHERE labelId = ?', [sync.entityId]);
    }
    else if (sync.entityName === 'api_tokens') {
        entity = await sql.getRow('SELECT * FROM api_tokens WHERE apiTokenId = ?', [sync.entityId]);
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
        sourceId: sourceIdService.getCurrentSourceId(),
        entity: entity
    };

    await syncRequest(syncContext, 'PUT', '/api/sync/' + sync.entityName, payload);
}

function serializeNoteContentBuffer(note) {
    if (note.type === 'file') {
        note.content = note.content.toString("binary");
    }
}

async function checkContentHash(syncContext) {
    const resp = await syncRequest(syncContext, 'GET', '/api/sync/check');

    if (await getLastSyncedPull() < resp.max_sync_id) {
        log.info("There are some outstanding pulls, skipping content check.");

        return;
    }

    const lastSyncedPush = await getLastSyncedPush();
    const notPushedSyncs = await sql.getValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    if (notPushedSyncs > 0) {
        log.info("There's " + notPushedSyncs + " outstanding pushes, skipping content check.");

        return;
    }

    const hashes = await contentHashService.getHashes();
    let allChecksPassed = true;

    for (const key in hashes) {
        if (hashes[key] !== resp.hashes[key]) {
            allChecksPassed = false;

            await eventLogService.addEvent(`Content hash check for ${key} FAILED. Local is ${hashes[key]}, remote is ${resp.hashes[key]}`);

            if (key !== 'recent_notes') {
                // let's not get alarmed about recent notes which get updated often and can cause failures in race conditions
                await messagingService.sendMessageToAllClients({type: 'sync-hash-check-failed'});
            }
        }
    }

    if (allChecksPassed) {
        log.info("Content hash checks PASSED");
    }
}

async function syncRequest(syncContext, method, uri, body) {
    const fullUri = syncSetup.SYNC_SERVER + uri;

    try {
        const options = {
            method: method,
            uri: fullUri,
            jar: syncContext.cookieJar,
            json: true,
            body: body,
            timeout: syncSetup.SYNC_TIMEOUT
        };

        if (syncServerCertificate) {
            options.ca = syncServerCertificate;
        }

        if (syncSetup.SYNC_PROXY && proxyToggle) {
            options.proxy = syncSetup.SYNC_PROXY;
        }

        return await rp(options);
    }
    catch (e) {
        throw new Error(`Request to ${method} ${fullUri} failed, inner exception: ${e.stack}`);
    }
}

sqlInit.dbReady.then(() => {
    if (syncSetup.isSyncSetup) {
        log.info("Setting up sync to " + syncSetup.SYNC_SERVER + " with timeout " + syncSetup.SYNC_TIMEOUT);

        if (syncSetup.SYNC_PROXY) {
            log.info("Sync proxy: " + syncSetup.SYNC_PROXY);
        }

        if (syncSetup.SYNC_CERT_PATH) {
            log.info('Sync certificate: ' + syncSetup.SYNC_CERT_PATH);

            syncServerCertificate = fs.readFileSync(syncSetup.SYNC_CERT_PATH);
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
    serializeNoteContentBuffer
};