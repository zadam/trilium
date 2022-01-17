const sql = require('./sql');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');
const utils = require('./utils');
const instanceId = require('./member_id');
const becca = require("../becca/becca");

let maxEntityChangeId = 0;

function addEntityChangeWithinstanceId(origEntityChange, instanceId) {
    const ec = {...origEntityChange, instanceId};

    return addEntityChange(ec);
}

function addEntityChange(origEntityChange) {
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

    cls.addEntityChange(ec);
}

function addNoteReorderingEntityChange(parentNoteId, componentId) {
    addEntityChange({
        entityName: "note_reordering",
        entityId: parentNoteId,
        hash: 'N/A',
        isErased: false,
        utcDateChanged: dateUtils.utcNowDateTime(),
        isSynced: true,
        componentId,
        instanceId
    });

    const eventService = require('./events');

    eventService.emit(eventService.ENTITY_CHANGED, {
        entityName: 'note_reordering',
        entity: sql.getMap(`SELECT branchId, notePosition FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [parentNoteId])
    });
}

function moveEntityChangeToTop(entityName, entityId) {
    const ec = sql.getRow(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [entityName, entityId]);

    addEntityChange(ec);
}

function addEntityChangesForSector(entityName, sector) {
    const startTime = Date.now();

    const entityChanges = sql.getRows(`SELECT * FROM entity_changes WHERE entityName = ? AND SUBSTR(entityId, 1, 1) = ?`, [entityName, sector]);

    sql.transactional(() => {
        for (const ec of entityChanges) {
            addEntityChange(ec);
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

        sql.transactional(() => {
            const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName}`
                + (condition ? ` WHERE ${condition}` : ''));

            let createdCount = 0;

            for (const entityId of entityIds) {
                const existingRows = sql.getValue("SELECT COUNT(1) FROM entity_changes WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

                // we don't want to replace existing entities (which would effectively cause full resync)
                if (existingRows === 0) {
                    createdCount++;

                    const entity = becca.getEntity(entityName, entityId);

                    addEntityChange({
                        entityName,
                        entityId,
                        hash: entity.generateHash(),
                        isErased: false,
                        utcDateChanged: entity.getUtcDateChanged(),
                        isSynced: entityName !== 'options' || !!entity.isSynced
                    });
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
        fillEntityChanges("etapi_tokens", "etapiTokenId");
        fillEntityChanges("options", "name", 'isSynced = 1');
    });
}

module.exports = {
    addNoteReorderingEntityChange,
    moveEntityChangeToTop,
    addEntityChange,
    addEntityChangeWithinstanceId,
    fillAllEntityChanges,
    addEntityChangesForSector,
    getMaxEntityChangeId: () => maxEntityChangeId
};
