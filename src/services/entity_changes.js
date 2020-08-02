const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

let maxEntityChangeId = 0;

function insertEntityChange(entityName, entityId, sourceId = null, isSynced = true) {
    const sync = {
        entityName: entityName,
        entityId: entityId,
        utcSyncDate: dateUtils.utcNowDateTime(),
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId(),
        isSynced: isSynced ? 1 : 0
    };

    sync.id = sql.replace("sync", sync);

    maxEntityChangeId = Math.max(maxEntityChangeId, sync.id);

    return sync;
}

function addEntityChange(entityName, entityId, sourceId, isSynced) {
    const sync = insertEntityChange(entityName, entityId, sourceId, isSynced);

    cls.addSyncRow(sync);
}

function addEntityChangesForSector(entityName, entityPrimaryKey, sector) {
    const startTime = Date.now();

    sql.transactional(() => {
        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName} WHERE SUBSTR(${entityPrimaryKey}, 1, 1) = ?`, [sector]);

        for (const entityId of entityIds) {
            if (entityName === 'options') {
                const isSynced = sql.getValue(`SELECT isSynced FROM options WHERE name = ?`, [entityId]);

                if (!isSynced) {
                    continue;
                }
            }

            insertEntityChange(entityName, entityId, 'content-check', true);
        }
    });

    log.info(`Added sector ${sector} of ${entityName} to sync queue in ${Date.now() - startTime}ms.`);
}

function cleanupSyncRowsForMissingEntities(entityName, entityPrimaryKey) {
    sql.execute(`
      DELETE 
      FROM entity_changes 
      WHERE sync.entityName = '${entityName}' 
        AND sync.entityId NOT IN (SELECT ${entityPrimaryKey} FROM ${entityName})`);
}

function fillEntityChanges(entityName, entityPrimaryKey, condition = '') {
    try {
        cleanupSyncRowsForMissingEntities(entityName, entityPrimaryKey);

        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName}`
            + (condition ? ` WHERE ${condition}` : ''));

        let createdCount = 0;

        for (const entityId of entityIds) {
            const existingRows = sql.getValue("SELECT COUNT(1) FROM entity_changes WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

            // we don't want to replace existing entities (which would effectively cause full resync)
            if (existingRows === 0) {
                createdCount++;

                sql.insert("sync", {
                    entityName: entityName,
                    entityId: entityId,
                    sourceId: "SYNC_FILL",
                    utcSyncDate: dateUtils.utcNowDateTime(),
                    isSynced: 1
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
        log.error(`Filling sync rows failed for ${entityName} ${entityPrimaryKey} with error "${e.message}", continuing`);
    }
}

function fillAllEntityChanges() {
    sql.transactional(() => {
        sql.execute("DELETE FROM entity_changes");

        fillEntityChanges("notes", "noteId");
        fillEntityChanges("note_contents", "noteId");
        fillEntityChanges("branches", "branchId");
        fillEntityChanges("note_revisions", "noteRevisionId");
        fillEntityChanges("note_revision_contents", "noteRevisionId");
        fillEntityChanges("recent_notes", "noteId");
        fillEntityChanges("attributes", "attributeId");
        fillEntityChanges("api_tokens", "apiTokenId");
        fillEntityChanges("options", "name", 'isSynced = 1');
    });
}

module.exports = {
    addNoteSync: (noteId, sourceId) => addEntityChange("notes", noteId, sourceId),
    addNoteContentSync: (noteId, sourceId) => addEntityChange("note_contents", noteId, sourceId),
    addBranchSync: (branchId, sourceId) => addEntityChange("branches", branchId, sourceId),
    addNoteReorderingSync: (parentNoteId, sourceId) => addEntityChange("note_reordering", parentNoteId, sourceId),
    addNoteRevisionSync: (noteRevisionId, sourceId) => addEntityChange("note_revisions", noteRevisionId, sourceId),
    addNoteRevisionContentSync: (noteRevisionId, sourceId) => addEntityChange("note_revision_contents", noteRevisionId, sourceId),
    addOptionsSync: (name, sourceId, isSynced) => addEntityChange("options", name, sourceId, isSynced),
    addRecentNoteSync: (noteId, sourceId) => addEntityChange("recent_notes", noteId, sourceId),
    addAttributeSync: (attributeId, sourceId) => addEntityChange("attributes", attributeId, sourceId),
    addApiTokenSync: (apiTokenId, sourceId) => addEntityChange("api_tokens", apiTokenId, sourceId),
    addEntityChange,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId
};
