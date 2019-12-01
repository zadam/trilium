const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entityName: entityName,
        entityId: entityId,
        utcSyncDate: dateUtils.utcNowDateTime(),
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
    try {
        await cleanupSyncRowsForMissingEntities(entityName, entityKey);

        const entityIds = await sql.getColumn(`SELECT ${entityKey} FROM ${entityName}`
            + (condition ? ` WHERE ${condition}` : ''));

        let createdCount = 0;

        for (const entityId of entityIds) {
            const existingRows = await sql.getValue("SELECT COUNT(1) FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

            // we don't want to replace existing entities (which would effectively cause full resync)
            if (existingRows === 0) {
                createdCount++;

                await sql.insert("sync", {
                    entityName: entityName,
                    entityId: entityId,
                    sourceId: "SYNC_FILL",
                    utcSyncDate: dateUtils.utcNowDateTime()
                });
            }
        }

        if (createdCount > 0) {
            log.info(`Created ${createdCount} missing sync records for ${entityName}.`);
        }
    }
    catch (e) {
        // this is to fix migration from 0.30 to 0.32, can be removed later
        // see https://github.com/zadam/trilium/issues/557
        log.error(`Filling sync rows failed for ${entityName} ${entityKey} with error "${e.message}", continuing`);
    }
}

async function fillAllSyncRows() {
    await sql.execute("DELETE FROM sync");

    await fillSyncRows("notes", "noteId");
    await fillSyncRows("note_contents", "noteId");
    await fillSyncRows("branches", "branchId");
    await fillSyncRows("note_revisions", "noteRevisionId");
    await fillSyncRows("note_revision_contents", "noteRevisionId");
    await fillSyncRows("recent_notes", "noteId");
    await fillSyncRows("attributes", "attributeId");
    await fillSyncRows("api_tokens", "apiTokenId");
    await fillSyncRows("options", "name", 'isSynced = 1');
}

module.exports = {
    addNoteSync: async (noteId, sourceId) => await addEntitySync("notes", noteId, sourceId),
    addNoteContentSync: async (noteId, sourceId) => await addEntitySync("note_contents", noteId, sourceId),
    addBranchSync: async (branchId, sourceId) => await addEntitySync("branches", branchId, sourceId),
    addNoteReorderingSync: async (parentNoteId, sourceId) => await addEntitySync("note_reordering", parentNoteId, sourceId),
    addNoteRevisionSync: async (noteRevisionId, sourceId) => await addEntitySync("note_revisions", noteRevisionId, sourceId),
    addNoteRevisionContentSync: async (noteRevisionId, sourceId) => await addEntitySync("note_revision_contents", noteRevisionId, sourceId),
    addOptionsSync: async (name, sourceId) => await addEntitySync("options", name, sourceId),
    addRecentNoteSync: async (noteId, sourceId) => await addEntitySync("recent_notes", noteId, sourceId),
    addAttributeSync: async (attributeId, sourceId) => await addEntitySync("attributes", attributeId, sourceId),
    addApiTokenSync: async (apiTokenId, sourceId) => await addEntitySync("api_tokens", apiTokenId, sourceId),
    addEntitySync,
    fillAllSyncRows
};