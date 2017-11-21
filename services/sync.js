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

const SYNC_SERVER = config['Sync']['syncServerHost'];
const isSyncSetup = !!SYNC_SERVER;
const SYNC_TIMEOUT = config['Sync']['syncServerTimeout'] || 5000;
const SYNC_PROXY = config['Sync']['syncProxy'];

let syncInProgress = false;
let proxyToggle = true;

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
        if (!await migration.isDbUpToDate()) {
            log.info("DB not up to date");

            return {
                success: false,
                message: "DB not up to date"
            };
        }

        const syncContext = await login();

        await pushSync(syncContext);

        await pullSync(syncContext);

        await pushSync(syncContext);

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
    const timestamp = utils.nowTimestamp();

    const documentSecret = await options.getOption('document_secret');
    const hash = utils.hmac(documentSecret, timestamp);

    const syncContext = { cookieJar: rp.jar() };

    const resp = await syncRequest(syncContext, 'POST', '/api/login/sync', {
        timestamp: timestamp,
        dbVersion: migration.APP_DB_VERSION,
        hash: hash
    });

    syncContext.sourceId = resp.sourceId;

    return syncContext;
}

async function pullSync(syncContext) {
    const lastSyncedPull = parseInt(await options.getOption('last_synced_pull'));

    const changesUri = '/api/sync/changed?lastSyncId=' + lastSyncedPull;

    const syncRows = await syncRequest(syncContext, 'GET', changesUri);

    log.info("Pulled " + syncRows.length + " changes from " + changesUri);

    for (const sync of syncRows) {
        if (source_id.isLocalSourceId(sync.source_id)) {
            log.info("Skipping " + sync.entity_name + " " + sync.entity_id + " because it has local source id.");

            continue;
        }

        console.log("Pulling ", sync);

        const resp = await syncRequest(syncContext, 'GET', "/api/sync/" + sync.entity_name + "/" + sync.entity_id);

        if (sync.entity_name === 'notes') {
            await syncUpdate.updateNote(resp.entity, resp.links, syncContext.sourceId);
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

        await options.setOption('last_synced_pull', sync.id);
    }

    log.info("Finished pull");
}

async function pushSync(syncContext) {
    let lastSyncedPush = parseInt(await options.getOption('last_synced_push'));

    while (true) {
        const sync = await sql.getSingleResultOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

        if (sync === null) {
            // nothing to sync

            log.info("Nothing to push");

            break;
        }

        if (sync.source_id === syncContext.sourceId) {
            log.info("Skipping sync " + sync.entity_name + " " + sync.entity_id + " because it originates from sync target");
        }
        else {
            await readAndPushEntity(sync, syncContext);
        }

        lastSyncedPush = sync.id;

        await options.setOption('last_synced_push', lastSyncedPush);
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
        entity = await sql.getSingleResult('SELECT * FROM recent_notes WHERE note_path = ?', [sync.entity_id]);
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

    if (entityName === 'notes') {
        payload.links = await sql.getResults('SELECT * FROM links WHERE note_id = ?', [entity.note_id]);
    }

    await syncRequest(syncContext, 'PUT', '/api/sync/' + entityName, payload);
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

        if (SYNC_PROXY && proxyToggle) {
            options.proxy = SYNC_PROXY;
        }

        return await rp(options);
    }
    catch (e) {
        throw new Error("Request to " + method + " " + fullUri + " failed, inner exception: " + e.stack);
    }
}

if (isSyncSetup) {
    log.info("Setting up sync to " + SYNC_SERVER + " with timeout " + SYNC_TIMEOUT);

    if (SYNC_PROXY) {
        log.info("Sync proxy: " + SYNC_PROXY);
    }

    setInterval(sync, 60000);

    // kickoff initial sync immediately
    setTimeout(sync, 1000);
}
else {
    log.info("Sync server not configured, sync timer not running.")
}

module.exports = {
    sync,
    isSyncSetup
};