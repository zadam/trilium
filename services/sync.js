"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const migration = require('./migration');
const utils = require('./utils');
const config = require('./config');
const audit_category = require('./audit_category');
const crypto = require('crypto');

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

async function pushSync(cookieJar, syncLog) {
    const lastSyncedPush = parseInt(await sql.getOption('last_synced_push'));
    const syncStarted = utils.nowTimestamp();

    const changed = await getChangedSince(lastSyncedPush);

    if (changed.tree.length > 0 || changed.audit_log.length > 0) {
        logSync("Sending " + changed.tree.length + " tree changes and " + changed.audit_log.length + " audit changes", syncLog);

        try {
            await rp({
                method: 'PUT',
                uri: SYNC_SERVER + '/api/sync/changed',
                headers: {
                    auth: 'sync'
                },
                body: changed,
                json: true,
                timeout: 300 * 1000, // this can take long time
                jar: cookieJar
            });
        }
        catch (e) {
            throw new Error("Can't send tree changes and audit, inner exception: " + e.stack);
        }
    }

    for (const noteId of changed.notes) {
        logSync("Sending note " + noteId, syncLog);

        const note = await getNoteSince(noteId);

        try {
            await rp({
                method: 'PUT',
                uri: SYNC_SERVER + '/api/sync/note',
                headers: {
                    auth: 'sync'
                },
                body: note,
                json: true,
                timeout: 60 * 1000,
                jar: cookieJar
            });
        }
        catch (e) {
            throw new Error("Can't send note update, inner exception: " + e.stack);
        }
    }

    await sql.setOption('last_synced_push', syncStarted);
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

async function putNote(note, syncLog) {
    const origNote = await sql.getSingleResult("select * from notes where note_id = ?", [note.detail.note_id]);

    try {
        if (origNote !== null && origNote.date_modified >= note.detail.date_modified) {
            // version we have in DB is actually newer than the one we're getting from sync
            // so we'll leave the current state as it is. The synced version should be stored in the history
        }
        else {
            await sql.insert("notes", note.detail, true);
        }

        await sql.remove("images", note.detail.note_id);

        for (const image of note.images) {
            await sql.insert("images", image);
        }

        for (const history of note.history) {
            delete history['id'];

            await sql.insert("notes_history", history, true);
        }

        logSync("Update/sync note " + note.detail.note_id, syncLog);
    }
    catch (e) {
        throw new Error("Update note " + note.detail.note_id + " failed, inner exception: " + e.stack);
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
    putNote
};