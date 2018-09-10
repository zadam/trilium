"use strict";

const syncService = require('../../services/sync');
const setupService = require('../../services/setup');
const syncUpdateService = require('../../services/sync_update');
const syncTableService = require('../../services/sync_table');
const sql = require('../../services/sql');
const sqlInit = require('../../services/sql_init');
const optionService = require('../../services/options');
const contentHashService = require('../../services/content_hash');
const log = require('../../services/log');

async function testSync() {
    try {
        if (await setupService.isSyncServerInitialized()) {
            await syncService.login();

            return { success: true, message: "Sync server handshake has been successful" };
        }
        else {
            await setupService.setupSyncToSyncServer();

            return { success: true, message: "Sync has been established to the server instance. It will take some time to finish." };
        }
    }
    catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

async function getStats() {
    if (!await sqlInit.schemaExists()) {
        // fail silently but prevent errors from not existing options table
        return {};
    }

    return {
        initialized: await optionService.getOption('initialized') === 'true',
        stats: syncService.stats
    };
}

async function checkSync() {
    return {
        hashes: await contentHashService.getHashes(),
        maxSyncId: await sql.getValue('SELECT MAX(id) FROM sync')
    };
}

async function syncNow() {
    return await syncService.sync();
}

async function fillSyncRows() {
    await syncTableService.fillAllSyncRows();

    log.info("Sync rows have been filled.");
}

async function forceFullSync() {
    await optionService.setOption('lastSyncedPull', 0);
    await optionService.setOption('lastSyncedPush', 0);

    log.info("Forcing full sync.");

    // not awaiting for the job to finish (will probably take a long time)
    syncService.sync();
}

async function forceNoteSync(req) {
    const noteId = req.params.noteId;

    await syncTableService.addNoteSync(noteId);

    for (const branchId of await sql.getColumn("SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ?", [noteId])) {
        await syncTableService.addBranchSync(branchId);
        await syncTableService.addRecentNoteSync(branchId);
    }

    for (const noteRevisionId of await sql.getColumn("SELECT noteRevisionId FROM note_revisions WHERE noteId = ?", [noteId])) {
        await syncTableService.addNoteRevisionSync(noteRevisionId);
    }

    log.info("Forcing note sync for " + noteId);

    // not awaiting for the job to finish (will probably take a long time)
    syncService.sync();
}

async function getChanged(req) {
    const lastSyncId = parseInt(req.query.lastSyncId);

    const syncs = await sql.getRows("SELECT * FROM sync WHERE id > ? LIMIT 1000", [lastSyncId]);

    return {
        syncs: await syncService.getSyncRecords(syncs),
        maxSyncId: await sql.getValue('SELECT MAX(id) FROM sync')
    };
}

async function update(req) {
    const sourceId = req.body.sourceId;
    const entities = req.body.entities;

    for (const {sync, entity} of entities) {
        await syncUpdateService.updateEntity(sync, entity, sourceId);
    }
}

async function syncFinished() {
    // after first sync finishes, the application is ready to be used
    // this is meaningless but at the same time harmless (idempotent) for further syncs
    await sqlInit.dbInitialized();
}

module.exports = {
    testSync,
    checkSync,
    syncNow,
    fillSyncRows,
    forceFullSync,
    forceNoteSync,
    getChanged,
    update,
    getStats,
    syncFinished
};