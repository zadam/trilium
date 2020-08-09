const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

let maxEntityChangeId = 0;

function insertEntityChange(entityName, entityId, sourceId = null, isSynced = true) {
    const entityChange = {
        entityName: entityName,
        entityId: entityId,
        utcChangedDate: dateUtils.utcNowDateTime(),
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId(),
        isSynced: isSynced ? 1 : 0
    };

    entityChange.id = sql.replace("entity_changes", entityChange);

    maxEntityChangeId = Math.max(maxEntityChangeId, entityChange.id);

    return entityChange;
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
                    utcChangedDate: dateUtils.utcNowDateTime(),
                    isSynced: 1
                });
            }
        }

        if (createdCount > 0) {
            log.info(`Created ${createdCount} missing entity changes for ${entityName}.`);
        }
    }
    catch (e) {
        // this is to fix migration from 0.30 to 0.32, can be removed later
        // see https://github.com/zadam/trilium/issues/557
        log.error(`Filling entity changes failed for ${entityName} ${entityPrimaryKey} with error "${e.message}", continuing`);
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
    addNoteEntityChange: (noteId, sourceId) => addEntityChange("notes", noteId, sourceId),
    addNoteContentEntityChange: (noteId, sourceId) => addEntityChange("note_contents", noteId, sourceId),
    addBranchEntityChange: (branchId, sourceId) => addEntityChange("branches", branchId, sourceId),
    addNoteReorderingEntityChange: (parentNoteId, sourceId) => addEntityChange("note_reordering", parentNoteId, sourceId),
    addNoteRevisionEntityChange: (noteRevisionId, sourceId) => addEntityChange("note_revisions", noteRevisionId, sourceId),
    addNoteRevisionContentEntityChange: (noteRevisionId, sourceId) => addEntityChange("note_revision_contents", noteRevisionId, sourceId),
    addOptionEntityChange: (name, sourceId, isSynced) => addEntityChange("options", name, sourceId, isSynced),
    addRecentNoteEntityChange: (noteId, sourceId) => addEntityChange("recent_notes", noteId, sourceId),
    addAttributeEntityChange: (attributeId, sourceId) => addEntityChange("attributes", attributeId, sourceId),
    addApiTokenEntityChange: (apiTokenId, sourceId) => addEntityChange("api_tokens", apiTokenId, sourceId),
    addEntityChange,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId
};
