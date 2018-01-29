const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');
const sync_setup = require('./sync_setup');
const log = require('./log');

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addNoteTreeSync(noteTreeId, sourceId) {
    await addEntitySync("note_tree", noteTreeId, sourceId)
}

async function addNoteReorderingSync(parentNoteId, sourceId) {
    await addEntitySync("note_reordering", parentNoteId, sourceId)
}

async function addNoteHistorySync(noteRevisionId, sourceId) {
    await addEntitySync("note_revisions", noteRevisionId, sourceId);
}

async function addOptionsSync(name, sourceId) {
    await addEntitySync("options", name, sourceId);
}

async function addRecentNoteSync(noteTreeId, sourceId) {
    await addEntitySync("recent_notes", noteTreeId, sourceId);
}

async function addImageSync(imageId, sourceId) {
    await addEntitySync("images", imageId, sourceId);
}

async function addNoteImageSync(noteImageId, sourceId) {
    await addEntitySync("note_images", noteImageId, sourceId);
}

async function addAttributeSync(attributeId, sourceId) {
    await addEntitySync("attributes", attributeId, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entityName: entityName,
        entityId: entityId,
        syncDate: utils.nowDate(),
        sourceId: sourceId || source_id.getCurrentSourceId()
    });

    if (!sync_setup.isSyncSetup) {
        // this is because the "server" instances shouldn't have outstanding pushes
        // useful when you fork the DB for new "client" instance, it won't try to sync the whole DB
        await sql.execute("UPDATE options SET value = (SELECT MAX(id) FROM sync) WHERE name IN('last_synced_push', 'last_synced_pull')");
    }
}

async function cleanupSyncRowsForMissingEntities(entityName, entityKey) {
    await sql.execute(`
      DELETE 
      FROM sync 
      WHERE sync.entityName = '${entityName}' 
        AND sync.entityId NOT IN (SELECT ${entityKey} FROM ${entityName})`);
}

async function fillSyncRows(entityName, entityKey) {
    await cleanupSyncRowsForMissingEntities(entityName, entityKey);

    const entityIds = await sql.getColumn(`SELECT ${entityKey} FROM ${entityName}`);

    for (const entityId of entityIds) {
        const existingRows = await sql.getValue("SELECT COUNT(id) FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

        // we don't want to replace existing entities (which would effectively cause full resync)
        if (existingRows === 0) {
            log.info(`Creating missing sync record for ${entityName} ${entityId}`);

            await sql.insert("sync", {
                entityName: entityName,
                entityId: entityId,
                sourceId: "SYNC_FILL",
                syncDate: utils.nowDate()
            });
        }
    }
}

async function fillAllSyncRows() {
    await fillSyncRows("notes", "noteId");
    await fillSyncRows("note_tree", "noteTreeId");
    await fillSyncRows("note_revisions", "noteRevisionId");
    await fillSyncRows("recent_notes", "noteTreeId");
    await fillSyncRows("images", "imageId");
    await fillSyncRows("note_images", "noteImageId");
    await fillSyncRows("attributes", "attributeId");
}

module.exports = {
    addNoteSync,
    addNoteTreeSync,
    addNoteReorderingSync,
    addNoteHistorySync,
    addOptionsSync,
    addRecentNoteSync,
    addImageSync,
    addNoteImageSync,
    addAttributeSync,
    cleanupSyncRowsForMissingEntities,
    fillAllSyncRows
};