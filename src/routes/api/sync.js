"use strict";

const sync = require('../../services/sync');
const syncUpdate = require('../../services/sync_update');
const sync_table = require('../../services/sync_table');
const sql = require('../../services/sql');
const options = require('../../services/options');
const content_hash = require('../../services/content_hash');
const log = require('../../services/log');

async function checkSync() {
    return {
        'hashes': await content_hash.getHashes(),
        'max_sync_id': await sql.getValue('SELECT MAX(id) FROM sync')
    };
}

async function syncNow() {
    return await sync.sync();
}

async function fillSyncRows() {
    await sync_table.fillAllSyncRows();

    log.info("Sync rows have been filled.");
}

async function forceFullSync() {
    await options.setOption('last_synced_pull', 0);
    await options.setOption('last_synced_push', 0);

    log.info("Forcing full sync.");

    // not awaiting for the job to finish (will probably take a long time)
    sync.sync();
}

async function forceNoteSync(req) {
    const noteId = req.params.noteId;

    await sync_table.addNoteSync(noteId);

    for (const branchId of await sql.getColumn("SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ?", [noteId])) {
        await sync_table.addBranchSync(branchId);
        await sync_table.addRecentNoteSync(branchId);
    }

    for (const noteRevisionId of await sql.getColumn("SELECT noteRevisionId FROM note_revisions WHERE noteId = ?", [noteId])) {
        await sync_table.addNoteRevisionSync(noteRevisionId);
    }

    log.info("Forcing note sync for " + noteId);

    // not awaiting for the job to finish (will probably take a long time)
    sync.sync();
}

async function getChanged() {
    const lastSyncId = parseInt(req.query.lastSyncId);

    return await sql.getRows("SELECT * FROM sync WHERE id > ?", [lastSyncId]);
}

async function getNote(req) {
    const noteId = req.params.noteId;
    const entity = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    sync.serializeNoteContentBuffer(entity);

    return {
        entity: entity
    };
}

async function getBranch(req) {
    const branchId = req.params.branchId;

    return await sql.getRow("SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

async function getNoteRevision(req) {
    const noteRevisionId = req.params.noteRevisionId;

    return await sql.getRow("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [noteRevisionId]);
}

async function getOption(req) {
    const name = req.params.name;
    const opt = await sql.getRow("SELECT * FROM options WHERE name = ?", [name]);

    if (!opt.isSynced) {
        return [400, "This option can't be synced."];
    }
    else {
        return opt;
    }
}

async function getNoteReordering(req) {
    const parentNoteId = req.params.parentNoteId;

    return {
        parentNoteId: parentNoteId,
        ordering: await sql.getMap("SELECT branchId, notePosition FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId])
    };
}

async function getRecentNote(req) {
    const branchId = req.params.branchId;

    return await sql.getRow("SELECT * FROM recent_notes WHERE branchId = ?", [branchId]);
}

async function getImage(req) {
    const imageId = req.params.imageId;
    const entity = await sql.getRow("SELECT * FROM images WHERE imageId = ?", [imageId]);

    if (entity && entity.data !== null) {
        entity.data = entity.data.toString('base64');
    }

    return entity;
}

async function getNoteImage(req) {
    const noteImageId = req.params.noteImageId;

    return await sql.getRow("SELECT * FROM note_images WHERE noteImageId = ?", [noteImageId]);
}

async function getLabel(req) {
    const labelId = req.params.labelId;

    return await sql.getRow("SELECT * FROM labels WHERE labelId = ?", [labelId]);
}

async function getApiToken(req) {
    const apiTokenId = req.params.apiTokenId;

    return await sql.getRow("SELECT * FROM api_tokens WHERE apiTokenId = ?", [apiTokenId]);
}

async function updateNote(req) {
    await syncUpdate.updateNote(req.body.entity, req.body.sourceId);
}

async function updateBranch(req) {
    await syncUpdate.updateBranch(req.body.entity, req.body.sourceId);
}

async function updateNoteRevision(req) {
    await syncUpdate.updateNoteRevision(req.body.entity, req.body.sourceId);
}

async function updateNoteReordering(req) {
    await syncUpdate.updateNoteReordering(req.body.entity, req.body.sourceId);
}

async function updateOption(req) {
    await syncUpdate.updateOptions(req.body.entity, req.body.sourceId);
}

async function updateRecentNote(req) {
    await syncUpdate.updateRecentNotes(req.body.entity, req.body.sourceId);
}

async function updateImage(req) {
    await syncUpdate.updateImage(req.body.entity, req.body.sourceId);
}

async function updateNoteImage(req) {
    await syncUpdate.updateNoteImage(req.body.entity, req.body.sourceId);
}

async function updateLabel(req) {
    await syncUpdate.updateLabel(req.body.entity, req.body.sourceId);
}

async function updateApiToken(req) {
    await syncUpdate.updateApiToken(req.body.entity, req.body.sourceId);
}

module.exports = {
    checkSync,
    syncNow,
    fillSyncRows,
    forceFullSync,
    forceNoteSync,
    getChanged,
    getNote,
    getBranch,
    getImage,
    getNoteImage,
    getNoteReordering,
    getNoteRevision,
    getRecentNote,
    getOption,
    getLabel,
    getApiToken,
    updateNote,
    updateBranch,
    updateImage,
    updateNoteImage,
    updateNoteReordering,
    updateNoteRevision,
    updateRecentNote,
    updateOption,
    updateLabel,
    updateApiToken
};