"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const migration = require('./migration');
const utils = require('./utils');
const config = require('./config');
const audit_category = require('./audit_category');
const crypto = require('crypto');
const SOURCE_ID = require('./source_id');

const SYNC_SERVER = config['Sync']['syncServerHost'];


let syncInProgress = false;

async function pullSync(cookieJar, syncLog) {
    const lastSyncedPull = parseInt(await sql.getOption('last_synced_pull'));

    let resp;

    try {
        resp = await rp({
            uri: SYNC_SERVER + '/api/sync/changed/' + lastSyncedPull,
            headers: {
                auth: 'sync'
            },
            jar: cookieJar,
            json: true
        });
    }
    catch (e) {
        throw new Error("Can't pull changed, inner exception: " + e.stack);
    }

    try {
        await sql.doInTransaction(async () => {
            await putChanged(resp, syncLog);

            for (const noteId of resp.notes) {
                let note;

                try {
                    note = await rp({
                        uri: SYNC_SERVER + "/api/sync/note/" + noteId + "/" + lastSyncedPull,
                        headers: {
                            auth: 'sync'
                        },
                        json: true,
                        jar: cookieJar
                    });
                }
                catch (e) {
                    throw new Error("Can't pull note " + noteId + ", inner exception: " + e.stack);
                }

                await putNote(note, syncLog);
            }

            if (resp.notes.length > 0) {
                await sql.addAudit(audit_category.SYNC);
            }

            await sql.setOption('last_synced_pull', resp.syncTimestamp);
        });
    }
    catch (e) {
        throw e;
    }
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
        throw new Error("Failed sending update for entity " + entityName + ", inner exception: " + e.stack);
    }
}

async function syncEntities(entities, entityName, cookieJar, syncLog) {
    for (const entity of entities) {
        await syncEntity(entity, entityName, cookieJar, syncLog);
    }
}

async function pushSync(cookieJar, syncLog) {
    let lastSyncedPush = parseInt(await sql.getOption('last_synced_push'));
    const syncStarted = utils.nowTimestamp();

    while (true) {
        const oldestUnsyncedDateModified = await sql.getSingleValue(`
    SELECT MIN(date_modified) FROM (
        SELECT MIN(date_modified) AS date_modified FROM notes_tree WHERE date_modified > ?
        UNION
        SELECT MIN(date_modified) AS date_modified FROM notes WHERE date_modified > ?
        UNION
        SELECT MIN(date_modified_to) AS date_modified FROM notes_history WHERE date_modified_to > ?
    )`, [lastSyncedPush, lastSyncedPush, lastSyncedPush]);

        if (oldestUnsyncedDateModified === null) {
            break;
        }

        await sql.doInTransaction(async () => {
            const notesTree = await sql.getResults('SELECT * FROM notes_tree WHERE date_modified = ?', [oldestUnsyncedDateModified]);
            await syncEntities(notesTree, 'notes_tree', cookieJar, syncLog);

            const notes = await sql.getResults('SELECT * FROM notes WHERE date_modified = ?', [oldestUnsyncedDateModified]);
            await syncEntities(notes, 'notes', cookieJar, syncLog);

            const notesHistory = await sql.getResults('SELECT * FROM notes_history WHERE date_modified_to = ?', [oldestUnsyncedDateModified]);
            await syncEntities(notesHistory, 'notes_history', cookieJar, syncLog);

            lastSyncedPush = oldestUnsyncedDateModified;

            // if the sync started in the same second as the last changes then it's possible we synced only parts
            // of this second's changes. In that case we'll leave the last_synced_push as it is and stop the sync
            // so next time we'll re-do this second again, this guaranteeing all changes have been pushed
            if (lastSyncedPush === syncStarted) {
                return;
            }

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

async function getChangedSince(since) {
    return {
        'syncTimestamp': utils.nowTimestamp(),
        'tree': await sql.getResults("select * from notes_tree where date_modified >= ?", [since]),
        'notes': await sql.getFlattenedResults('note_id', "select note_id from notes where date_modified >= ?", [since]),
        'audit_log': await sql.getResults("select * from audit_log where category != 'SYNC' and date_modified >= ?", [since])
    };
}

async function getNoteSince(noteId, since) {
    return {
        'detail': await sql.getSingleResult("select * from notes where note_id = ?", [noteId]),
        'images': await sql.getResults("select * from images where note_id = ? order by note_offset", [noteId]),
        'history': await sql.getResults("select * from notes_history where note_id = ? and date_modified_to >= ?", [noteId, since])
    };
}

async function putChanged(changed, syncLog) {
    for (const treeItem of changed.tree) {
        delete treeItem['id'];

        await sql.insert("notes_tree", treeItem, true);

        logSync("Update/sync notes_tree " + treeItem.note_id, syncLog);
    }

    for (const audit of changed.audit_log) {
        await sql.insert("audit_log", audit, true);

        logSync("Update/sync audit_log for category=" + audit.category + ", noteId=" + audit.note_id, syncLog);
    }

    if (changed.tree.length > 0 || changed.audit_log.length > 0) {
        logSync("Added final audit", syncLog);

        await sql.addAudit(audit_category.SYNC);
    }
}

async function updateNote(body, syncLog) {
    const entity = body.entity;

    const origNote = await sql.getSingleResult("select * from notes where note_id = ?", [entity.note_id]);

    if (origNote === null || origNote.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await sql.remove("links", entity.note_id);

            for (const link of body.links) {
                delete link['lnk_id'];

                await sql.insert('link', link);
            }

            await sql.addNoteSync(entity.note_id, body.source_id);
        });

        logSync("Update/sync note " + entity.note_id, syncLog);
    }
    else {
        logSync("Sync conflict in note " + entity.note_id, syncLog);
    }
}

async function updateNoteTree(body, syncLog) {
    const entity = body.entity;

    const orig = await sql.getSingleResultOrNull("select * from notes_tree where note_id = ?", [entity.note_id]);

    if (orig === null || orig.date_modified < entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace('notes_tree', entity);

            await sql.addNoteTreeSync(entity.note_id, body.source_id);
        });

        logSync("Update/sync note tree " + entity.note_id, syncLog);
    }
    else {
        logSync("Sync conflict in note tree " + entity.note_id, syncLog);
    }
}

async function updateNoteHistory(body, syncLog) {
    const entity = body.entity;

    const orig = await sql.getSingleResultOrNull("select * from notes_history where note_history_id", [entity.note_history_id]);

    if (orig === null || orig.date_modified_to < entity.date_modified_to) {
        await sql.doInTransaction(async () => {
            await sql.execute("delete from notes_history where note_history_id", [entity.note_history_id]);

            delete entity['id'];

            await sql.insert('notes_history', entity);

            await sql.addNoteHistorySync(entity.note_history_id, body.source_id);
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
    getChangedSince,
    getNoteSince,
    putChanged,
    updateNote,
    updateNoteTree,
    updateNoteHistory
};