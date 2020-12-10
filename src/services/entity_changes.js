const sql = require('./sql');
const repository = require('./repository');
const sourceIdService = require('./source_id');
const log = require('./log');
const cls = require('./cls');

let maxEntityChangeId = 0;

function insertEntityChange(entityName, entityId, hash, sourceId = null, isSynced = true) {
    const entityChange = {
        entityName: entityName,
        entityId: entityId,
        hash: hash,
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId(),
        isSynced: isSynced ? 1 : 0
    };

    entityChange.id = sql.replace("entity_changes", entityChange);

    maxEntityChangeId = Math.max(maxEntityChangeId, entityChange.id);

    return entityChange;
}

function addEntityChange(entityName, entityId, hash, sourceId, isSynced) {
    const sync = insertEntityChange(entityName, entityId, hash, sourceId, isSynced);

    cls.addSyncRow(sync);
}

function moveEntityChangeToTop(entityName, entityId) {
    const [hash, isSynced] = sql.getRow(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [entityName, entityId]);

    addEntityChange(entityName, entityId, hash, null, isSynced);
}

function addEntityChangesForSector(entityName, entityPrimaryKey, sector) {
    const startTime = Date.now();

    sql.transactional(() => {
        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName} WHERE SUBSTR(${entityPrimaryKey}, 1, 1) = ?`, [sector]);

        for (const entityId of entityIds) {
            // retrieving entity one by one to avoid memory issues with note_contents
            const entity = repository.getEntity(`SELECT * FROM ${entityName} WHERE ${entityPrimaryKey} = ?`, [entityId]);

            if (entityName === 'options' && !entity.isSynced) {
                continue
            }

            insertEntityChange(entityName, entityId, entity.generateHash(), 'content-check', true);
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

                sql.insert("entity_changes", {
                    entityName: entityName,
                    entityId: entityId,
                    sourceId: "SYNC_FILL",
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
    addNoteReorderingEntityChange: (parentNoteId, sourceId) => addEntityChange("note_reordering", parentNoteId, sourceId),
    moveEntityChangeToTop,
    addEntityChange,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId
};
