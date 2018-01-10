const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');
const sync_setup = require('./sync_setup');
const log = require('./log');

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addNoteTreeSync(noteTreeId, sourceId) {
    await addEntitySync("notes_tree", noteTreeId, sourceId)
}

async function addNoteReorderingSync(parentNoteTreeId, sourceId) {
    await addEntitySync("notes_reordering", parentNoteTreeId, sourceId)
}

async function addNoteHistorySync(noteHistoryId, sourceId) {
    await addEntitySync("notes_history", noteHistoryId, sourceId);
}

async function addOptionsSync(optName, sourceId) {
    await addEntitySync("options", optName, sourceId);
}

async function addRecentNoteSync(noteTreeId, sourceId) {
    await addEntitySync("recent_notes", noteTreeId, sourceId);
}

async function addImageSync(imageId, sourceId) {
    await addEntitySync("images", imageId, sourceId);
}

async function addNoteImageSync(noteImageId, sourceId) {
    await addEntitySync("notes_image", noteImageId, sourceId);
}

async function addAttributeSync(noteImageId, sourceId) {
    await addEntitySync("attributes", noteImageId, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entity_name: entityName,
        entity_id: entityId,
        sync_date: utils.nowDate(),
        source_id: sourceId || source_id.getCurrentSourceId()
    });

    if (!sync_setup.isSyncSetup) {
        // this is because the "server" instances shouldn't have outstanding pushes
        // useful when you fork the DB for new "client" instance, it won't try to sync the whole DB
        await sql.execute("UPDATE options SET opt_value = (SELECT MAX(id) FROM sync) WHERE opt_name IN('last_synced_push', 'last_synced_pull')");
    }
}

async function cleanupSyncRowsForMissingEntities(entityName, entityKey) {
    await sql.execute(`
      DELETE 
      FROM sync 
      WHERE sync.entity_name = '${entityName}' 
        AND sync.entity_id NOT IN (SELECT ${entityKey} FROM ${entityName})`);
}

async function fillSyncRows(entityName, entityKey) {
    await cleanupSyncRowsForMissingEntities(entityName, entityKey);

    const entityIds = await sql.getFirstColumn(`SELECT ${entityKey} FROM ${entityName}`);

    for (const entityId of entityIds) {
        const existingRows = await sql.getFirstValue("SELECT COUNT(id) FROM sync WHERE entity_name = ? AND entity_id = ?", [entityName, entityId]);

        // we don't want to replace existing entities (which would effectively cause full resync)
        if (existingRows === 0) {
            log.info(`Creating missing sync record for ${entityName} ${entityId}`);

            await sql.insert("sync", {
                entity_name: entityName,
                entity_id: entityId,
                source_id: "SYNC_FILL",
                sync_date: utils.nowDate()
            });
        }
    }
}

async function fillAllSyncRows() {
    await fillSyncRows("notes", "note_id");
    await fillSyncRows("notes_tree", "note_tree_id");
    await fillSyncRows("notes_history", "note_history_id");
    await fillSyncRows("recent_notes", "note_tree_id");
    await fillSyncRows("images", "image_id");
    await fillSyncRows("notes_image", "note_image_id");
    await fillSyncRows("attributes", "attribute_id");
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