/**
 * TODO: rename "sync" table to something like "changelog" since it now also contains rows which are not synced (isSynced=false)
 */

const sql = require('./sql');
const sourceIdService = require('./source_id');
const dateUtils = require('./date_utils');
const log = require('./log');
const cls = require('./cls');

let maxSyncId = 0;

function insertEntitySync(entityName, entityId, sourceId = null, isSynced = true) {
    const sync = {
        entityName: entityName,
        entityId: entityId,
        utcSyncDate: dateUtils.utcNowDateTime(),
        sourceId: sourceId || cls.getSourceId() || sourceIdService.getCurrentSourceId(),
        isSynced: isSynced ? 1 : 0
    };

    sync.id = sql.replace("sync", sync);

    maxSyncId = Math.max(maxSyncId, sync.id);

    return sync;
}

function addEntitySync(entityName, entityId, sourceId, isSynced) {
    const sync = insertEntitySync(entityName, entityId, sourceId, isSynced);

    cls.addSyncRow(sync);
}

function addEntitySyncsForSector(entityName, entityPrimaryKey, sector) {
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

            insertEntitySync(entityName, entityId, 'content-check', true);
        }
    });

    log.info(`Added sector ${sector} of ${entityName} to sync queue in ${Date.now() - startTime}ms.`);
}

function cleanupSyncRowsForMissingEntities(entityName, entityPrimaryKey) {
    sql.execute(`
      DELETE 
      FROM sync 
      WHERE sync.entityName = '${entityName}' 
        AND sync.entityId NOT IN (SELECT ${entityPrimaryKey} FROM ${entityName})`);
}

function fillSyncRows(entityName, entityPrimaryKey, condition = '') {
    try {
        cleanupSyncRowsForMissingEntities(entityName, entityPrimaryKey);

        const entityIds = sql.getColumn(`SELECT ${entityPrimaryKey} FROM ${entityName}`
            + (condition ? ` WHERE ${condition}` : ''));

        let createdCount = 0;

        for (const entityId of entityIds) {
            const existingRows = sql.getValue("SELECT COUNT(1) FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

            // we don't want to replace existing entities (which would effectively cause full resync)
            if (existingRows === 0) {
                createdCount++;

                sql.insert("sync", {
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
        log.error(`Filling sync rows failed for ${entityName} ${entityPrimaryKey} with error "${e.message}", continuing`);
    }
}

function fillAllSyncRows() {
    sql.transactional(() => {
        sql.execute("DELETE FROM sync");

        fillSyncRows("notes", "noteId");
        fillSyncRows("note_contents", "noteId");
        fillSyncRows("branches", "branchId");
        fillSyncRows("note_revisions", "noteRevisionId");
        fillSyncRows("note_revision_contents", "noteRevisionId");
        fillSyncRows("recent_notes", "noteId");
        fillSyncRows("attributes", "attributeId");
        fillSyncRows("api_tokens", "apiTokenId");
        fillSyncRows("options", "name", 'isSynced = 1');
    });
}

module.exports = {
    addNoteSync: (noteId, sourceId) => addEntitySync("notes", noteId, sourceId),
    addNoteContentSync: (noteId, sourceId) => addEntitySync("note_contents", noteId, sourceId),
    addBranchSync: (branchId, sourceId) => addEntitySync("branches", branchId, sourceId),
    addNoteReorderingSync: (parentNoteId, sourceId) => addEntitySync("note_reordering", parentNoteId, sourceId),
    addNoteRevisionSync: (noteRevisionId, sourceId) => addEntitySync("note_revisions", noteRevisionId, sourceId),
    addNoteRevisionContentSync: (noteRevisionId, sourceId) => addEntitySync("note_revision_contents", noteRevisionId, sourceId),
    addOptionsSync: (name, sourceId, isSynced) => addEntitySync("options", name, sourceId, isSynced),
    addRecentNoteSync: (noteId, sourceId) => addEntitySync("recent_notes", noteId, sourceId),
    addAttributeSync: (attributeId, sourceId) => addEntitySync("attributes", attributeId, sourceId),
    addApiTokenSync: (apiTokenId, sourceId) => addEntitySync("api_tokens", apiTokenId, sourceId),
    addEntitySync,
    fillAllSyncRows,
    addEntitySyncsForSector,
    getMaxSyncId: () => maxSyncId
};
