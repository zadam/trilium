const sql = require('./sql.js');
const dateUtils = require('./date_utils.js');
const log = require('./log.js');
const cls = require('./cls.js');
const utils = require('./utils.js');
const instanceId = require('./instance_id.js');
const becca = require('../becca/becca.js');
const blobService = require('../services/blob.js');

let maxEntityChangeId = 0;

function putEntityChangeWithInstanceId(origEntityChange, instanceId) {
    const ec = {...origEntityChange, instanceId};

    putEntityChange(ec);
}

function putEntityChangeWithForcedChange(origEntityChange) {
    const ec = {...origEntityChange, changeId: null};

    putEntityChange(ec);
}

function putEntityChange(origEntityChange) {
    const ec = {...origEntityChange};

    delete ec.id;

    if (!ec.changeId) {
        ec.changeId = utils.randomString(12);
    }

    ec.componentId = ec.componentId || cls.getComponentId() || "NA"; // NA = not available
    ec.instanceId = ec.instanceId || instanceId;
    ec.isSynced = ec.isSynced ? 1 : 0;
    ec.isErased = ec.isErased ? 1 : 0;
    ec.id = sql.replace("entity_changes", ec);

    maxEntityChangeId = Math.max(maxEntityChangeId, ec.id);

    cls.putEntityChange(ec);
}

function putNoteReorderingEntityChange(parentNoteId, componentId) {
    putEntityChange({
        entityName: "note_reordering",
        entityId: parentNoteId,
        hash: 'N/A',
        isErased: false,
        utcDateChanged: dateUtils.utcNowDateTime(),
        isSynced: true,
        componentId,
        instanceId
    });

    const eventService = require('./events.js');

    eventService.emit(eventService.ENTITY_CHANGED, {
        entityName: 'note_reordering',
        entity: sql.getMap(`SELECT branchId, notePosition FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [parentNoteId])
    });
}

function putEntityChangeForOtherInstances(ec) {
    putEntityChange({
        ...ec,
        changeId: null,
        instanceId: null
    });
}

function addEntityChangesForSector(entityName, sector) {
    const entityChanges = sql.getRows(`SELECT * FROM entity_changes WHERE entityName = ? AND SUBSTR(entityId, 1, 1) = ?`, [entityName, sector]);

    let entitiesInserted = entityChanges.length;

    sql.transactional(() => {
        if (entityName === 'blobs') {
            entitiesInserted += addEntityChangesForDependingEntity(sector, 'notes', 'noteId');
            entitiesInserted += addEntityChangesForDependingEntity(sector, 'attachments', 'attachmentId');
            entitiesInserted += addEntityChangesForDependingEntity(sector, 'revisions', 'revisionId');
        }

        for (const ec of entityChanges) {
            putEntityChangeWithForcedChange(ec);
        }
    });

    log.info(`Added sector ${sector} of '${entityName}' (${entitiesInserted} entities) to the sync queue.`);
}

function addEntityChangesForDependingEntity(sector, tableName, primaryKeyColumn) {
    // problem in blobs might be caused by problem in entity referencing the blob
    const dependingEntityChanges = sql.getRows(`
                SELECT dep_change.* 
                FROM entity_changes orig_sector
                JOIN ${tableName} ON ${tableName}.blobId = orig_sector.entityId
                JOIN entity_changes dep_change ON dep_change.entityName = '${tableName}' AND dep_change.entityId = ${tableName}.${primaryKeyColumn}
                WHERE orig_sector.entityName = 'blobs' AND SUBSTR(orig_sector.entityId, 1, 1) = ?`, [sector]);

    for (const ec of dependingEntityChanges) {
        putEntityChangeWithForcedChange(ec);
    }

    return dependingEntityChanges.length;
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
    cleanupEntityChangesForMissingEntities(entityName, entityPrimaryKey);

    sql.transactional(() => {
        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName} ${condition}`);

        let createdCount = 0;

        for (const entityId of entityIds) {
            const existingRows = sql.getValue("SELECT COUNT(1) FROM entity_changes WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

            if (existingRows !== 0) {
                // we don't want to replace existing entities (which would effectively cause full resync)
                continue;
            }

            createdCount++;

            const ec = {
                entityName,
                entityId,
                isErased: false
            };

            if (entityName === 'blobs') {
                const blob = sql.getRow("SELECT blobId, content, utcDateModified FROM blobs WHERE blobId = ?", [entityId]);
                ec.hash = blobService.calculateContentHash(blob);
                ec.utcDateChanged = blob.utcDateModified;
                ec.isSynced = true; // blobs are always synced
            } else {
                const entity = becca.getEntity(entityName, entityId);

                if (entity) {
                    ec.hash = entity.generateHash();
                    ec.utcDateChanged = entity.getUtcDateChanged() || dateUtils.utcNowDateTime();
                    ec.isSynced = entityName !== 'options' || !!entity.isSynced;
                } else {
                    // entity might be null (not present in becca) when it's deleted
                    // this will produce different hash value than when entity is being deleted since then
                    // all normal hashed attributes are being used. Sync should recover from that, though.
                    ec.hash = "deleted";
                    ec.utcDateChanged = dateUtils.utcNowDateTime();
                    ec.isSynced = true; // deletable (the ones with isDeleted) entities are synced
                }
            }

            putEntityChange(ec);
        }

        if (createdCount > 0) {
            log.info(`Created ${createdCount} missing entity changes for entity '${entityName}'.`);
        }
    });
}

function fillAllEntityChanges() {
    sql.transactional(() => {
        sql.execute("DELETE FROM entity_changes WHERE isErased = 0");

        fillEntityChanges("notes", "noteId");
        fillEntityChanges("branches", "branchId");
        fillEntityChanges("revisions", "revisionId");
        fillEntityChanges("attachments", "attachmentId");
        fillEntityChanges("blobs", "blobId");
        fillEntityChanges("attributes", "attributeId");
        fillEntityChanges("etapi_tokens", "etapiTokenId");
        fillEntityChanges("options", "name", 'WHERE isSynced = 1');
    });
}

function recalculateMaxEntityChangeId() {
    maxEntityChangeId = sql.getValue("SELECT COALESCE(MAX(id), 0) FROM entity_changes");
}

module.exports = {
    putNoteReorderingEntityChange,
    putEntityChangeForOtherInstances,
    putEntityChangeWithForcedChange,
    putEntityChange,
    putEntityChangeWithInstanceId,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId,
    recalculateMaxEntityChangeId
};
