"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const options = require('./options');
const migration = require('./migration');
const utils = require('./utils');
const config = require('./config');
const source_id = require('./source_id');
const notes = require('./notes');
const syncUpdate = require('./sync_update');
const content_hash = require('./content_hash');
const event_log = require('./event_log');
const fs = require('fs');
const app_info = require('./app_info');

const SYNC_SERVER = config['Sync']['syncServerHost'];
const isSyncSetup = !!SYNC_SERVER;
const SYNC_TIMEOUT = config['Sync']['syncServerTimeout'] || 5000;
const SYNC_PROXY = config['Sync']['syncProxy'];

let syncInProgress = false;
let proxyToggle = true;
let syncServerCertificate = null;

async function sync() {
    if (syncInProgress) {
        log.info("Sync already in progress");

        return {
            success: false,
            message: "Sync already in progress"
        };
    }

    syncInProgress = true;

    try {
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
    finally {
        syncInProgress = false;
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
        if (source_id.isLocalSourceId(sync.source_id)) {
            log.info("Skipping pull " + sync.entity_name + " " + sync.entity_id + " because it has local source id.");

            await setLastSyncedPull(sync.id);

            continue;
        }

        const resp = await syncRequest(syncContext, 'GET', "/api/sync/" + sync.entity_name + "/" + encodeURIComponent(sync.entity_id));

        if (!resp) {
            log.error("Empty response to pull for " + sync.entity_name + ", id=" + sync.entity_id);
        }
        else if (sync.entity_name === 'notes') {
            await syncUpdate.updateNote(resp.entity, syncContext.sourceId);
        }
        else if (sync.entity_name === 'notes_tree') {
            await syncUpdate.updateNoteTree(resp, syncContext.sourceId);
        }
        else if (sync.entity_name === 'notes_history') {
            await syncUpdate.updateNoteHistory(resp, syncContext.sourceId);
        }
        else if (sync.entity_name === 'notes_reordering') {
            await syncUpdate.updateNoteReordering(resp, syncContext.sourceId);
        }
        else if (sync.entity_name === 'options') {
            await syncUpdate.updateOptions(resp, syncContext.sourceId);
        }
        else if (sync.entity_name === 'recent_notes') {
            await syncUpdate.updateRecentNotes(resp, syncContext.sourceId);
        }
        else {
            throw new Error("Unrecognized entity type " + sync.entity_name);
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
        const sync = await sql.getSingleResultOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

        if (sync === null) {
            // nothing to sync

            log.info("Nothing to push");

            break;
        }

        if (sync.source_id === syncContext.sourceId) {
            log.info("Skipping push " + sync.entity_name + " " + sync.entity_id + " because it originates from sync target");
        }
        else {
            await readAndPushEntity(sync, syncContext);
        }

        lastSyncedPush = sync.id;

        await setLastSyncedPush(lastSyncedPush);
    }
}

async function readAndPushEntity(sync, syncContext) {
    let entity;

    if (sync.entity_name === 'notes') {
        entity = await sql.getSingleResult('SELECT * FROM notes WHERE note_id = ?', [sync.entity_id]);
    }
    else if (sync.entity_name === 'notes_tree') {
        entity = await sql.getSingleResult('SELECT * FROM notes_tree WHERE note_tree_id = ?', [sync.entity_id]);
    }
    else if (sync.entity_name === 'notes_history') {
        entity = await sql.getSingleResult('SELECT * FROM notes_history WHERE note_history_id = ?', [sync.entity_id]);
    }
    else if (sync.entity_name === 'notes_reordering') {
        entity = {
            note_pid: sync.entity_id,
            ordering: await sql.getMap('SELECT note_tree_id, note_pos FROM notes_tree WHERE note_pid = ?', [sync.entity_id])
        };
    }
    else if (sync.entity_name === 'options') {
        entity = await sql.getSingleResult('SELECT * FROM options WHERE opt_name = ?', [sync.entity_id]);
    }
    else if (sync.entity_name === 'recent_notes') {
        entity = await sql.getSingleResult('SELECT * FROM recent_notes WHERE note_tree_id = ?', [sync.entity_id]);
    }
    else {
        throw new Error("Unrecognized entity type " + sync.entity_name);
    }

    if (!entity) {
        log.info("Sync entity for " + sync.entity_name + " " + sync.entity_id + " doesn't exist. Skipping.");
        return;
    }

    log.info("Pushing changes in " + sync.entity_name + " " + sync.entity_id);

    await sendEntity(syncContext, entity, sync.entity_name);
}

async function sendEntity(syncContext, entity, entityName) {
    const payload = {
        sourceId: source_id.currentSourceId,
        entity: entity
    };

    await syncRequest(syncContext, 'PUT', '/api/sync/' + entityName, payload);
}

async function checkContentHash(syncContext) {
    const lastSyncedPush = await getLastSyncedPush();
    const notPushedSyncs = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    if (notPushedSyncs > 0) {
        log.info("There's " + notPushedSyncs + " outstanding pushes, skipping content check.");

        return;
    }

    const resp = await syncRequest(syncContext, 'GET', '/api/sync/check');

    // if (await getLastSyncedPull() < resp.max_sync_id) {
    //     log.info("There are some outstanding pulls, skipping content check.");
    //
    //     return;
    // }

    const localContentHash = await content_hash.getContentHash();

    if (resp.content_hash === localContentHash) {
        log.info("Content hash check PASSED with value: " + localContentHash);
    }
    else {
        await event_log.addEvent("Content hash check FAILED. Local is " + localContentHash + ", remote is " + resp.content_hash);
    }
}

async function syncRequest(syncContext, method, uri, body) {
    const fullUri = SYNC_SERVER + uri;

    try {
        const options = {
            method: method,
            uri: fullUri,
            jar: syncContext.cookieJar,
            json: true,
            body: body,
            timeout: SYNC_TIMEOUT
        };

        if (syncServerCertificate) {
            options.ca = syncServerCertificate;
        }

        if (SYNC_PROXY && proxyToggle) {
            options.proxy = SYNC_PROXY;
        }

        return await rp(options);
    }
    catch (e) {
        throw new Error("Request to " + method + " " + fullUri + " failed, inner exception: " + e.stack);
    }
}

sql.dbReady.then(() => {
    if (isSyncSetup) {
        log.info("Setting up sync to " + SYNC_SERVER + " with timeout " + SYNC_TIMEOUT);

        if (SYNC_PROXY) {
            log.info("Sync proxy: " + SYNC_PROXY);
        }

        const syncCertPath = config['Sync']['syncServerCertificate'];

        if (syncCertPath) {
            log.info('Sync certificate: ' + syncCertPath);

            syncServerCertificate = fs.readFileSync(syncCertPath);
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
    sync,
    isSyncSetup
};