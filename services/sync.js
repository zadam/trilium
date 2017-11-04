"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const options = require('./options');
const migration = require('./migration');
const utils = require('./utils');
const config = require('./config');
const SOURCE_ID = require('./source_id');
const audit_category = require('./audit_category');

const SYNC_SERVER = config['Sync']['syncServerHost'];
const isSyncSetup = !!SYNC_SERVER;


let syncInProgress = false;

async function pullSync(syncContext, syncLog) {
    const lastSyncedPull = parseInt(await options.getOption('last_synced_pull'));

    let syncRows;

    try {
        logSync("Pulling changes: " + SYNC_SERVER + '/api/sync/changed?lastSyncId=' + lastSyncedPull + "&sourceId=" + SOURCE_ID);

        syncRows = await rp({
            uri: SYNC_SERVER + '/api/sync/changed?lastSyncId=' + lastSyncedPull + "&sourceId=" + SOURCE_ID,
            jar: syncContext.cookieJar,
            json: true,
            timeout: 5 * 1000
        });

        logSync("Pulled " + syncRows.length + " changes");
    }
    catch (e) {
        logSyncError("Can't pull changes, inner exception: ", e, syncLog);
    }

    for (const sync of syncRows) {
        let resp;

        try {
            resp = await rp({
                uri: SYNC_SERVER + "/api/sync/" + sync.entity_name + "/" + sync.entity_id,
                json: true,
                jar: syncContext.cookieJar
            });
        }
        catch (e) {
            logSyncError("Can't pull " + sync.entity_name + " " + sync.entity_id, e, syncLog);
        }

        if (sync.entity_name === 'notes') {
            await updateNote(resp.entity, resp.links, syncContext.sourceId, syncLog);
        }
        else if (sync.entity_name === 'notes_tree') {
            await updateNoteTree(resp, syncContext.sourceId, syncLog);
        }
        else if (sync.entity_name === 'notes_history') {
            await updateNoteHistory(resp, syncContext.sourceId, syncLog);
        }
        else if (sync.entity_name === 'notes_reordering') {
            await updateNoteReordering(resp, syncContext.sourceId, syncLog);
        }
        else if (sync.entity_name === 'options') {
            await updateOptions(resp, syncContext.sourceId, syncLog);
        }
        else {
            logSyncError("Unrecognized entity type " + sync.entity_name, e, syncLog);
        }

        await options.setOption('last_synced_pull', sync.id);
    }

    logSync("Finished pull");
}

async function sendEntity(entity, entityName, cookieJar, syncLog) {
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
            timeout: 5 * 1000,
            jar: cookieJar
        });
    }
    catch (e) {
        logSyncError("Failed sending update for entity " + entityName, e, syncLog);
    }
}

async function readAndPushEntity(sync, syncLog, syncContext) {
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
    else if (sync.entity_name === 'notes_reordering') {
        entity = {
            note_pid: sync.entity_id,
            ordering: await sql.getMap('SELECT note_id, note_pos FROM notes_tree WHERE note_pid = ?', [sync.entity_id])
        };
    }
    else if (sync.entity_name === 'options') {
        entity = await sql.getSingleResult('SELECT * FROM options WHERE opt_name = ?', [sync.entity_id]);
    }
    else {
        logSyncError("Unrecognized entity type " + sync.entity_name, null, syncLog);
    }

    logSync("Pushing changes in " + sync.entity_name + " " + sync.entity_id);

    await sendEntity(entity, sync.entity_name, syncContext.cookieJar, syncLog);
}

async function pushSync(syncContext, syncLog) {
    let lastSyncedPush = parseInt(await options.getOption('last_synced_push'));

    while (true) {
        const sync = await sql.getSingleResultOrNull('SELECT * FROM sync WHERE id > ? LIMIT 1', [lastSyncedPush]);

        if (sync === null) {
            // nothing to sync

            logSync("Nothing to push", syncLog);

            break;
        }

        if (sync.source_id === syncContext.sourceId) {
            logSync("Skipping sync " + sync.entity_name + " " + sync.entity_id + " because it originates from sync target", syncLog);
        }
        else {
            await readAndPushEntity(sync, syncLog, syncContext);
        }

        lastSyncedPush = sync.id;

        await options.setOption('last_synced_push', lastSyncedPush);
    }
}

async function login(syncLog) {
    const timestamp = utils.nowTimestamp();

    const documentSecret = await options.getOption('document_secret');
    const hash = utils.hmac(documentSecret, timestamp);

    const cookieJar = rp.jar();

    try {
        const resp = await rp({
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

        return {
            cookieJar: cookieJar,
            sourceId: resp.sourceId
        };
    }
    catch (e) {
        logSyncError("Can't login to API for sync, inner exception: ", e, syncLog);
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

        const syncContext = await login(syncLog);

        await pushSync(syncContext, syncLog);

        await pullSync(syncContext, syncLog);

        await pushSync(syncContext, syncLog);
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
}

function logSyncError(message, e, syncLog) {
    let completeMessage = message;

    if (e) {
        completeMessage += ", inner exception: " + e.stack;
    }

    log.info(completeMessage);

    if (syncLog) {
        syncLog.push(completeMessage);
    }

    throw new Error(completeMessage);
}

async function updateNote(entity, links, sourceId, syncLog) {
    const origNote = await sql.getSingleResult("select * from notes where note_id = ?", [entity.note_id]);

    if (!origNote || origNote.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await sql.remove("links", entity.note_id);

            for (const link of links) {
                delete link['lnk_id'];

                await sql.insert('link', link);
            }

            await sql.addNoteSync(entity.note_id, sourceId);

            // we don't distinguish between those for now
            await sql.addSyncAudit(audit_category.UPDATE_CONTENT, sourceId, entity.note_id);
            await sql.addSyncAudit(audit_category.UPDATE_TITLE, sourceId, entity.note_id);
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

            await sql.addSyncAudit(audit_category.UPDATE_TITLE, sourceId, entity.note_id);
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
            await sql.replace('notes_history', entity);

            await sql.addNoteHistorySync(entity.note_history_id, sourceId);
        });

        logSync("Update/sync note history " + entity.note_history_id, syncLog);
    }
    else {
        logSync("Sync conflict in note history for " + entity.note_id + ", from=" + entity.date_modified_from + ", to=" + entity.date_modified_to, syncLog);
    }
}

async function updateNoteReordering(entity, sourceId, syncLog) {
    await sql.doInTransaction(async () => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute("UPDATE notes_tree SET note_pos = ? WHERE note_id = ?", [entity.ordering[key], key]);
        });

        await sql.addNoteReorderingSync(entity.note_pid, sourceId);
        await sql.addSyncAudit(audit_category.CHANGE_POSITION, sourceId, entity.note_pid);
    });
}

async function updateOptions(entity, sourceId, syncLog) {
    if (!options.SYNCED_OPTIONS.includes(entity.opt_name)) {
        return;
    }

    const orig = await sql.getSingleResultOrNull("select * from options where opt_name = ?", [entity.opt_name]);

    if (orig === null || orig.date_modified < entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace('options', entity);

            await sql.addOptionsSync(entity.opt_name, sourceId);
        });

        logSync("Update/sync options " + entity.opt_name, syncLog);
    }
    else {
        logSync("Sync conflict in options for " + entity.opt_name + ", date_modified=" + entity.date_modified, syncLog);
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
    updateNote,
    updateNoteTree,
    updateNoteHistory,
    updateNoteReordering,
    updateOptions,
    isSyncSetup
};