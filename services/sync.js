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

async function pullSync(cookieJar) {
    const lastSyncedPull = parseInt(await sql.getOption('last_synced_pull'));

    const resp = await rp({
        uri: SYNC_SERVER + '/api/sync/changed/' + lastSyncedPull,
        headers: {
            auth: 'sync'
        },
        json: true
    });

    try {
        await sql.beginTransaction();

        await putChanged(resp);

        for (const noteId of resp.notes) {
            const note = await rp({
                uri: SYNC_SERVER + "/api/sync/note/" + noteId + "/" + lastSyncedPull,
                headers: {
                    auth: 'sync'
                },
                json: true,
                jar: cookieJar
            });


            await putNote(note);
        }

        await sql.setOption('last_synced_pull', resp.syncTimestamp);

        await sql.commit();
    }
    catch (e) {
        await sql.rollback();

        throw e;
    }
}

async function pushSync(cookieJar) {
    const lastSyncedPush = parseInt(await sql.getOption('last_synced_push'));
    const syncStarted = utils.nowTimestamp();

    const changed = await getChangedSince(lastSyncedPush);

    await rp({
        method: 'PUT',
        uri: SYNC_SERVER + '/api/sync/changed',
        headers: {
            auth: 'sync'
        },
        body: changed,
        json: true,
        jar: cookieJar
    });

    for (const noteId of changed.notes) {
        const note = await getNoteSince(noteId);

        await rp({
            method: 'PUT',
            uri: SYNC_SERVER + '/api/sync/note',
            headers: {
                auth: 'sync'
            },
            body: note,
            json: true,
            jar: cookieJar
        });
    }

    await sql.setOption('last_synced_push', syncStarted);
}

async function login() {
    const timestamp = utils.nowTimestamp();

    const hmac = crypto.createHmac('sha256', documentSecret);
    hmac.update(timestamp);
    const hash = hmac.digest('base64');

    const cookieJar = rp.jar();

    await rp({
        method: 'POST',
        uri: SYNC_SERVER + '/api/login',
        body: {
            timestamp: timestamp,
            dbVersion: migration.APP_DB_VERSION,
            hash: hash
        },
        json: true,
        jar: cookieJar
    });

    return cookieJar;
}

async function sync() {
    if (syncInProgress) {
        return;
    }

    syncInProgress = true;

    try {
        if (!await migration.isDbUpToDate()) {
            return;
        }

        const cookieJar = await login();

        await pushSync(cookieJar);

        await pullSync(cookieJar);
    }
    catch (e) {
        log.error("sync failed: " + e.stack);
    }
    finally {
        syncInProgress = false;
    }
}

async function getChangedSince(since) {
    return {
        'documentId': await getDocumentId(),
        'syncTimestamp': utils.nowTimestamp(),
        'tree': await sql.getResults("select * from notes_tree where date_modified >= ?", [since]),
        'notes': await sql.getFlattenedResults('note_id', "select note_id from notes where date_modified >= ?", [since]),
        'audit_log': await sql.getResults("select * from audit_log where date_modified >= ?", [since])
    };
}

async function getNoteSince(noteId, since) {
    return {
        'detail': await sql.getSingleResult("select * from notes where note_id = ?", [noteId]),
        'images': await sql.getResults("select * from images where note_id = ? order by note_offset", [noteId]),
        'history': await sql.getResults("select * from notes_history where note_id = ? and date_modified_to >= ?", [noteId, since])
    };
}

async function putChanged(changed) {
    for (const treeItem of changed.tree) {
        delete treeItem['id'];

        await sql.insert("notes_tree", treeItem, true);

        log.info("Update/sync notes_tree " + treeItem.note_id);
    }

    for (const audit of changed.audit_log) {
        await sql.insert("audit_log", audit, true);

        log.info("Update/sync audit_log for noteId=" + audit.note_id);
    }

    if (changed.tree.length > 0 || changed.audit_log.length > 0) {
        await sql.addAudit(audit_category.SYNC);
    }
}

async function putNote(note) {
    const origNote = await sql.getSingleResult();

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

        await sql.insert("notes_history", history);
    }

    await sql.addAudit(audit_category.SYNC);

    log.info("Update/sync note " + note.detail.note_id);
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
    getChangedSince,
    getNoteSince,
    putChanged,
    putNote
};