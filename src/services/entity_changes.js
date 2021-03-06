const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

let maxEntityChangeId = 0;

function insertEntityChange(entityName, entityId, hash, isErased, utcDateChanged, sourceId = null, isSynced = true) {
    const entityChange = {
        entityName: entityName,
        entityId: entityId,
        hash: hash,
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId(),
        isSynced: isSynced ? 1 : 0,
        isErased: isErased ? 1 : 0,
        utcDateChanged: utcDateChanged
    };

    entityChange.id = sql.replace("entity_changes", entityChange);

    maxEntityChangeId = Math.max(maxEntityChangeId, entityChange.id);

    return entityChange;
}

function addEntityChange(entityChange, sourceId, isSynced) {
    const localEntityChange = insertEntityChange(entityChange.entityName, entityChange.entityId, entityChange.hash, entityChange.isErased, entityChange.utcDateChanged, sourceId, isSynced);

    cls.addEntityChange(localEntityChange);
}

function addNoteReorderingEntityChange(parentNoteId, sourceId) {
    addEntityChange({
        entityName: "note_reordering",
        entityId: parentNoteId,
        hash: 'N/A',
        isErased: false,
        utcDateChanged: dateUtils.utcNowDateTime()
    }, sourceId);

    const eventService = require('./events');

    eventService.emit(eventService.ENTITY_CHANGED, {
        entityName: 'note_reordering',
        entity: sql.getMap(`SELECT branchId, notePosition FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [parentNoteId])
    });
}

function moveEntityChangeToTop(entityName, entityId) {
    const [hash, isSynced] = sql.getRow(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [entityName, entityId]);

    addEntityChange(entityName, entityId, hash, null, isSynced);
}

function addEntityChangesForSector(entityName, entityPrimaryKey, sector) {
    const startTime = Date.now();
    const repository = require('./repository');

    sql.transactional(() => {
        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName} WHERE SUBSTR(${entityPrimaryKey}, 1, 1) = ?`, [sector]);

        for (const entityId of entityIds) {
            // retrieving entity one by one to avoid memory issues with note_contents
            const entity = repository.getEntity(`SELECT * FROM ${entityName} WHERE ${entityPrimaryKey} = ?`, [entityId]);

            if (entityName === 'options' && !entity.isSynced) {
                continue
            }

            insertEntityChange(entityName, entityId, entity.generateHash(), false, entity.getUtcDateChanged(), 'content-check', true);
        }
    });

    log.info(`Added sector ${sector} of ${entityName} to sync queue in ${Date.now() - startTime}ms.`);
}

function cleanupEntityChangesForMissingEntities(entityName, entityPrimaryKey) {
    sql.execute(`
      DELETE 
      FROM entity_changes 
      WHERE
        isErased = 0
        AND entityName = '${entityName}' 
        AND entityId NOT IN (SELECT ${entityPrimaryKey} FROM ${entityName})`);
}

function fillEntityChanges(entityName, entityPrimaryKey, condition = '') {
    try {
        cleanupEntityChangesForMissingEntities(entityName, entityPrimaryKey);

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
        sql.execute("DELETE FROM entity_changes WHERE isErased = 0");

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
    addNoteReorderingEntityChange,
    moveEntityChangeToTop,
    addEntityChange,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId
};
