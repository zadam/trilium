"use strict";

const log = require('./log');
const rp = require('request-promise');
const sql = require('./sql');
const migration = require('./migration');

const SYNC_SERVER = 'http://localhost:3000';


let syncInProgress = false;

async function sync() {
    try {
        syncInProgress = true;

        if (!await migration.isDbUpToDate()) {
            return;
        }

        const lastSynced = parseInt(await sql.getOption('last_synced'));

        const resp = await rp({
            uri: SYNC_SERVER + '/api/sync/changed/' + lastSynced,
            headers: {
                auth: 'sync'
            },
            json: true
        });

        try {
            await sql.beginTransaction();

            for (const treeItem of resp.tree) {
                delete treeItem['id'];

                await sql.insert("notes_tree", treeItem, true);

                log.info("Syncing notes_tree " + treeItem.note_id);
            }

            for (const audit of resp.audit_log) {
                delete audit['id'];

                await sql.insert("audit_log", audit, true);

                log.info("Syncing audit_log for noteId=" + audit.note_id);
            }

            for (const noteId of resp.notes) {
                const note = await rp({
                    uri: SYNC_SERVER + "/api/sync/note/" + noteId + "/" + lastSynced,
                    headers: {
                        auth: 'sync'
                    },
                    json: true
                });

                console.log(noteId);

                await sql.insert("notes", note.detail, true);

                await sql.remove("images", noteId);

                for (const image of note.images) {
                    await sql.insert("images", image);
                }

                for (const history of note.history) {
                    delete history['id'];

                    await sql.insert("notes_history", history);
                }
            }

            await sql.setOption('last_synced', syncTimestamp);

            await sql.commit();
        }
        catch (e) {
            await sql.rollback();

            throw e;
        }
    }
    catch (e) {
        log.error("sync failed: " + e.stack);
    }
    finally {
        syncInProgress = false;
    }
}

setInterval(sync, 60000);

setTimeout(sync, 1000);