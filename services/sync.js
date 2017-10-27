"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const migration = require('./migration');
const utils = require('./utils');

const SYNC_SERVER = 'http://localhost:3000';


let syncInProgress = false;

async function pullSync() {
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
                json: true
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

async function pushSync() {
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
        json: true
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
            json: true
        });
    }

    await sql.setOption('last_synced_pull', syncStarted);
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

        await pushSync();

        await pullSync();
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
}

async function putNote(note) {
    await sql.insert("notes", note.detail, true);

    await sql.remove("images", node.detail.note_id);

    for (const image of note.images) {
        await sql.insert("images", image);
    }

    for (const history of note.history) {
        delete history['id'];

        await sql.insert("notes_history", history);
    }

    log.info("Update/sync note " + note.detail.note_id);
}

setInterval(sync, 60000);

// kickoff initial sync immediately
setTimeout(sync, 1000);

module.exports = {
    getChangedSince,
    getNoteSince,
    putChanged,
    putNote
};