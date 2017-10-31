"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const migration = require('./migration');
const utils = require('./utils');
const config = require('./config');
const SOURCE_ID = require('./source_id');

const SYNC_SERVER = config['Sync']['syncServerHost'];


let syncInProgress = false;

async function pullSync(cookieJar, syncLog) {
    const lastSyncedPull = parseInt(await sql.getOption('last_synced_pull'));

    let syncRows;

    try {
        syncRows = await rp({
            uri: SYNC_SERVER + '/api/sync/changed?lastSyncId=' + lastSyncedPull + "&sourceId=" + SOURCE_ID,
            jar: cookieJar,
            json: true
        });

        logSync("Pulled " + syncRows.length + " changes");
    }
    catch (e) {
        throw new Error("Can't pull changes, inner exception: " + e.stack);
    }

    for (const sync of syncRows) {
        let resp;

        try {
            resp = await rp({
                uri: SYNC_SERVER + "/api/sync/" + sync.entity_name + "/" + sync.entity_id,
                json: true,
                jar: cookieJar
            });
        }
        catch (e) {
            throw new Error("Can't pull " + sync.entity_name + " " + sync.entity_id + ", inner exception: " + e.stack);
        }

        await sql.doInTransaction(async () => {
            if (sync.entity_name === 'notes') {
                await updateNote(resp.entity, resp.links, sync.source_id, syncLog)
            }
            else if (sync.entity_name === 'notes_tree') {
                await updateNoteTree(resp.entity, sync.source_id, syncLog)
            }
            else if (sync.entity_name === 'notes_history') {
                await updateNoteHistory(resp.entity, sync.source_id, syncLog)
            }
            else {
                logSync("Unrecognized entity type " + sync.entity_name, syncLog);

                throw new Error("Unrecognized entity type " + sync.entity_name);
            }

            await sql.setOption('last_synced_pull', sync.id);
        });
    }

    logSync("Finished pull");
}

async function syncEntity(entity, entityName, cookieJar, syncLog) {
    try {
        const payload = {
            sourceId: SOURCE_ID,
            entity: entity
        };

        if (entityName === 'notes') {
            payload.links = await sql.getResults('select * from links where note_id = ?', [entity.note_id]);
        }

        await rp({
            method: 'PUT',
            uri: SYNC_SERVER + '/api/sync/' + entityName,
            body: payload,
            json: true,
            timeout: 60 * 1000,
            jar: cookieJar
        });
    }
    catch (e) {
        logSync("Failed sending update for entity " + entityName + ", inner exception: " + e.stack, syncLog);

        throw new Error("Failed sending update for entity " + entityName + ", inner exception: " + e.stack);
    }
}

async function pushSync(cookieJar, syncLog) {
    let lastSyncedPush = parseInt(await sql.getOption('last_synced_push'));

    while (true) {
        const sync = await sql.getSingleResultOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

        if (sync === null) {
            // nothing to sync

            logSync("Nothing to push", syncLog);

            break;
        }

        await sql.doInTransaction(async () => {
            let entity;

            if (sync.entity_name === 'notes') {
                entity = await sql.getSingleResult('SELECT * FROM notes WHERE note_id = ?', [sync.entity_id]);
            }
            else if (sync.entity_name === 'notes_tree') {
                entity = await sql.getSingleResult('SELECT * FROM notes_tree WHERE note_id = ?', [sync.entity_id]);
            }
            else if (sync.entity_name === 'notes_history') {
                entity = await sql.getSingleResult('SELECT * FROM notes_history WHERE note_history_id = ?', [sync.entity_id]);
            }
            else {
                logSync("Unrecognized entity type " + sync.entity_name, syncLog);

                throw new Error("Unrecognized entity type " + sync.entity_name);
            }

            await syncEntity(entity, sync.entity_name, cookieJar, syncLog);

            lastSyncedPush = sync.id;

            await sql.setOption('last_synced_push', lastSyncedPush);
        });
    }
}

async function login() {
    const timestamp = utils.nowTimestamp();

    const documentSecret = await sql.getOption('document_secret');
    const hash = utils.hmac(documentSecret, timestamp);

    const cookieJar = rp.jar();

    try {
        await rp({
            method: 'POST',
            uri: SYNC_SERVER + '/api/login',
            body: {
                timestamp: timestamp,
                dbVersion: migration.APP_DB_VERSION,
                hash: hash
            },
            json: true,
            timeout: 5 * 1000,
            jar: cookieJar
        });

        return cookieJar;
    }
    catch (e) {
        throw new Error("Can't login to API for sync, inner exception: " + e.stack);
    }
}

async function sync() {
    const syncLog = [];

    if (syncInProgress) {
        syncLog.push("Sync already in progress");

        return syncLog;
    }

    syncInProgress = true;

    try {
        if (!await migration.isDbUpToDate()) {
            syncLog.push("DB not up to date");

            return syncLog;
        }

        const cookieJar = await login();

        await pushSync(cookieJar, syncLog);

        await pullSync(cookieJar, syncLog);
    }
    catch (e) {
        logSync("sync failed: " + e.stack, syncLog);
    }
    finally {
        syncInProgress = false;
    }

    return syncLog;
}

function logSync(message, syncLog) {
    log.info(message);

    if (syncLog) {
        syncLog.push(message);
    }

    console.log(message);
}

async function getChanged(lastSyncId, sourceId) {
    return await sql.getResults("SELECT * FROM sync WHERE id > ? AND source_id != ?", [lastSyncId, sourceId]);
}

async function updateNote(entity, links, sourceId, syncLog) {
    const origNote = await sql.getSingleResult("select * from notes where note_id = ?", [entity.note_id]);

    if (origNote === null || origNote.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await sql.remove("links", entity.note_id);

            for (const link of links) {
                delete link['lnk_id'];

                await sql.insert('link', link);
            }

            await sql.addNoteSync(entity.note_id, sourceId);
        });

        logSync("Update/sync note " + entity.note_id, syncLog);
    }
    else {
        logSync("Sync conflict in note " + entity.note_id, syncLog);
    }
}

async function updateNoteTree(entity, sourceId, syncLog) {
    const orig = await sql.getSingleResultOrNull("select * from notes_tree where note_id = ?", [entity.note_id]);

    if (orig === null || orig.date_modified < entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace('notes_tree', entity);

            await sql.addNoteTreeSync(entity.note_id, sourceId);
        });

        logSync("Update/sync note tree " + entity.note_id, syncLog);
    }
    else {
        logSync("Sync conflict in note tree " + entity.note_id, syncLog);
    }
}

async function updateNoteHistory(entity, sourceId, syncLog) {
    const orig = await sql.getSingleResultOrNull("select * from notes_history where note_history_id = ?", [entity.note_history_id]);

    if (orig === null || orig.date_modified_to < entity.date_modified_to) {
        await sql.doInTransaction(async () => {
            delete entity['id'];

            await sql.replace('notes_history', entity);

            await sql.addNoteHistorySync(entity.note_history_id, sourceId);
        });

        logSync("Update/sync note history " + entity.note_id, syncLog);
    }
    else {
        logSync("Sync conflict in note history for " + entity.note_id + ", from=" + entity.date_modified_from + ", to=" + entity.date_modified_to, syncLog);
    }
}

if (SYNC_SERVER) {
    log.info("Setting up sync");

    setInterval(sync, 60000);

    // kickoff initial sync immediately
    setTimeout(sync, 1000);
}
else {
    log.info("Sync server not configured, sync timer not running.")
}

module.exports = {
    sync,
    getChanged,
    updateNote,
    updateNoteTree,
    updateNoteHistory
};