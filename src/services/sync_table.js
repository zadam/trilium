const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const syncOptions = require('./sync_options');
const log = require('./log');
const cls = require('./cls');
const eventService = require('./events');

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addBranchSync(branchId, sourceId) {
    await addEntitySync("branches", branchId, sourceId)
}

async function addNoteReorderingSync(parentNoteId, sourceId) {
    await addEntitySync("note_reordering", parentNoteId, sourceId)
}

async function addNoteRevisionSync(noteRevisionId, sourceId) {
    await addEntitySync("note_revisions", noteRevisionId, sourceId);
}

async function addOptionsSync(name, sourceId) {
    await addEntitySync("options", name, sourceId);
}

async function addRecentNoteSync(branchId, sourceId) {
    await addEntitySync("recent_notes", branchId, sourceId);
}

async function addImageSync(imageId, sourceId) {
    await addEntitySync("images", imageId, sourceId);
}

async function addNoteImageSync(noteImageId, sourceId) {
    await addEntitySync("note_images", noteImageId, sourceId);
}

async function addLabelSync(labelId, sourceId) {
    await addEntitySync("labels", labelId, sourceId);
}

async function addApiTokenSync(apiTokenId, sourceId) {
    await addEntitySync("api_tokens", apiTokenId, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entityName: entityName,
        entityId: entityId,
        syncDate: dateUtils.nowDate(),
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId()
    });

    if (!await syncOptions.isSyncSetup()) {
        // this is because the "server" instances shouldn't have outstanding pushes
        // useful when you fork the DB for new "client" instance, it won't try to sync the whole DB
        await sql.execute("UPDATE options SET value = (SELECT MAX(id) FROM sync) WHERE name IN('lastSyncedPush', 'lastSyncedPull')");
    }

    eventService.emit(eventService.ENTITY_CHANGED, {
        entityName,
        entityId
    });
}

async function cleanupSyncRowsForMissingEntities(entityName, entityKey) {
    await sql.execute(`
      DELETE 
      FROM sync 
      WHERE sync.entityName = '${entityName}' 
        AND sync.entityId NOT IN (SELECT ${entityKey} FROM ${entityName})`);
}

async function fillSyncRows(entityName, entityKey, condition = '') {
    await cleanupSyncRowsForMissingEntities(entityName, entityKey);

    const entityIds = await sql.getColumn(`SELECT ${entityKey} FROM ${entityName}`
        + (condition ? ` WHERE ${condition}` : ''));

    for (const entityId of entityIds) {
        const existingRows = await sql.getValue("SELECT COUNT(id) FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

        // we don't want to replace existing entities (which would effectively cause full resync)
        if (existingRows === 0) {
            log.info(`Creating missing sync record for ${entityName} ${entityId}`);

            await sql.insert("sync", {
                entityName: entityName,
                entityId: entityId,
                sourceId: "SYNC_FILL",
                syncDate: dateUtils.nowDate()
            });
        }
    }
}

async function fillAllSyncRows() {
    await sql.execute("DELETE FROM sync");

    await fillSyncRows("notes", "noteId");
    await fillSyncRows("branches", "branchId");
    await fillSyncRows("note_revisions", "noteRevisionId");
    await fillSyncRows("recent_notes", "branchId");
    await fillSyncRows("images", "imageId");
    await fillSyncRows("note_images", "noteImageId");
    await fillSyncRows("labels", "labelId");
    await fillSyncRows("api_tokens", "apiTokenId");
    await fillSyncRows("options", "name", 'isSynced = 1');
}

module.exports = {
    addNoteSync,
    addBranchSync,
    addNoteReorderingSync,
    addNoteRevisionSync,
    addOptionsSync,
    addRecentNoteSync,
    addImageSync,
    addNoteImageSync,
    addLabelSync,
    addApiTokenSync,
    addEntitySync,
    cleanupSyncRowsForMissingEntities,
    fillAllSyncRows
};