"use strict";

const syncService = require('../../services/sync');
const syncUpdateService = require('../../services/sync_update');
const syncTableService = require('../../services/sync_table');
const sql = require('../../services/sql');
const optionService = require('../../services/options');
const contentHashService = require('../../services/content_hash');
const log = require('../../services/log');
const repository = require('../../services/repository');

async function testSync() {
    try {
        await syncService.login();

        return { connection: "Success" };
    }
    catch (e) {
        return {
            connection: "Failure",
            error: e.message
        };
    }
}

async function getStats() {
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

async function getDocument() {
    log.info("Serving document options.");

    return [
        await repository.getOption('documentId'),
        await repository.getOption('documentSecret')
    ];
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
    getDocument,
    getStats
};