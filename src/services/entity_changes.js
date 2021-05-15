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
    const ec = sql.getRow(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [entityName, entityId]);

    insertEntityChange(entityName, entityId, ec.hash, ec.isErased, ec.utcDateChanged, ec.sourceId, ec.isSynced);
}

function addEntityChangesForSector(entityName, sector) {
    const startTime = Date.now();

    const entityChanges = sql.getRows(`SELECT * FROM entity_changes WHERE entityName = ? AND SUBSTR(entityId, 1, 1) = ?`, [entityName, sector]);

    sql.transactional(() => {
        for (const ec of entityChanges) {
            insertEntityChange(entityName, ec.entityId, ec.hash, ec.isErased, ec.utcDateChanged, ec.sourceId, ec.isSynced);
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
        const repository = require("./repository.js");

        sql.transactional(() => {
            const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName}`
                + (condition ? ` WHERE ${condition}` : ''));

            let createdCount = 0;

            for (const entityId of entityIds) {
                const existingRows = sql.getValue("SELECT COUNT(1) FROM entity_changes WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

                // we don't want to replace existing entities (which would effectively cause full resync)
                if (existingRows === 0) {
                    createdCount++;

                    const entity = repository.getEntity(`SELECT * FROM ${entityName} WHERE ${entityPrimaryKey} = ?`, [entityId]);

                    addEntityChange({
                        entityName,
                        entityId,
                        hash: entity.generateHash(),
                        isErased: false,
                        utcDateChanged: entity.getUtcDateChanged()
                    }, null);
                }
            }

            if (createdCount > 0) {
                log.info(`Created ${createdCount} missing entity changes for ${entityName}.`);
            }
        });
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
