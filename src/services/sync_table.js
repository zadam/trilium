const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

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

async function addLinkSync(linkId, sourceId) {
    await addEntitySync("links", linkId, sourceId);
}

async function addAttributeSync(attributeId, sourceId) {
    await addEntitySync("attributes", attributeId, sourceId);
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
    await fillSyncRows("attributes", "attributeId");
    await fillSyncRows("api_tokens", "apiTokenId");
    await fillSyncRows("links", "linkId");
    await fillSyncRows("options", "name", 'isSynced = 1');
}

module.exports = {
    addNoteSync,
    addBranchSync,
    addNoteReorderingSync,
    addNoteRevisionSync,
    addOptionsSync,
    addRecentNoteSync,
    addAttributeSync,
    addApiTokenSync,
    addLinkSync,
    addEntitySync,
    fillAllSyncRows
};