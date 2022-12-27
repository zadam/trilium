const sql = require('./sql');
const log = require('./log');
const entityChangesService = require('./entity_changes');
const eventService = require('./events');
const entityConstructor = require("../becca/entity_constructor");

function updateEntity(entityChange, entityRow, instanceId) {
    // can be undefined for options with isSynced=false
    if (!entityRow) {
        if (entityChange.isSynced) {
            if (entityChange.isErased) {
                eraseEntity(entityChange, instanceId);
            }
            else {
                log.info(`Encountered synced non-erased entity change without entity: ${JSON.stringify(entityChange)}`);
            }
        }
        else if (entityChange.entityName !== 'options') {
            log.info(`Encountered unsynced non-option entity change without entity: ${JSON.stringify(entityChange)}`);
        }

        return;
    }

    const updated = entityChange.entityName === 'note_reordering'
        ? updateNoteReordering(entityChange, entityRow, instanceId)
        : updateNormalEntity(entityChange, entityRow, instanceId);

    if (updated) {
        if (entityRow.isDeleted) {
            eventService.emit(eventService.ENTITY_DELETE_SYNCED, {
                entityName: entityChange.entityName,
                entityId: entityChange.entityId
            });
        }
        else if (!entityChange.isErased) {
            eventService.emit(eventService.ENTITY_CHANGE_SYNCED, {
                entityName: entityChange.entityName,
                entityRow
            });
        }
    }
}

function updateNormalEntity(remoteEntityChange, remoteEntityRow, instanceId) {
    const localEntityChange = sql.getRow(`
        SELECT utcDateChanged, hash, isErased
        FROM entity_changes 
        WHERE entityName = ? AND entityId = ?`, [remoteEntityChange.entityName, remoteEntityChange.entityId]);

    if (localEntityChange && !localEntityChange.isErased && remoteEntityChange.isErased) {
        sql.transactional(() => {
            const primaryKey = entityConstructor.getEntityFromEntityName(remoteEntityChange.entityName).primaryKeyName;

            sql.execute(`DELETE FROM ${remoteEntityChange.entityName} WHERE ${primaryKey} = ?`, remoteEntityChange.entityId);

            entityChangesService.addEntityChangeWithInstanceId(remoteEntityChange, instanceId);
        });

        return true;
    }

    if (!localEntityChange
        || localEntityChange.utcDateChanged < remoteEntityChange.utcDateChanged
        || localEntityChange.hash !== remoteEntityChange.hash // sync error, we should still update
    ) {
        if (['note_contents', 'note_revision_contents'].includes(remoteEntityChange.entityName)) {
            remoteEntityRow.content = handleContent(remoteEntityRow.content);
        }

        sql.transactional(() => {
            sql.replace(remoteEntityChange.entityName, remoteEntityRow);

            entityChangesService.addEntityChangeWithInstanceId(remoteEntityChange, instanceId);
        });

        return true;
    }

    return false;
}

function updateNoteReordering(entityChange, entity, instanceId) {
    sql.transactional(() => {
        for (const key in entity) {
            sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [entity[key], key]);
        }

        entityChangesService.addEntityChangeWithInstanceId(entityChange, instanceId);
    });

    return true;
}

function handleContent(content) {
    // we always use Buffer object which is different from normal saving - there we use simple string type for
    // "string notes". The problem is that in general it's not possible to detect whether a note_content
    // is string note or note (syncs can arrive out of order)
    content = content === null ? null : Buffer.from(content, 'base64');

    if (content && content.byteLength === 0) {
        // there seems to be a bug which causes empty buffer to be stored as NULL which is then picked up as inconsistency
        content = "";
    }

    return content;
}

function eraseEntity(entityChange, instanceId) {
    const {entityName, entityId} = entityChange;

    if (!["notes", "note_contents", "branches", "attributes", "note_revisions", "note_revision_contents"].includes(entityName)) {
        log.error(`Cannot erase entity '${entityName}', id '${entityId}'`);
        return;
    }

    const keyName = entityConstructor.getEntityFromEntityName(entityName).primaryKeyName;

    sql.execute(`DELETE FROM ${entityName} WHERE ${keyName} = ?`, [entityId]);

    eventService.emit(eventService.ENTITY_DELETE_SYNCED, { entityName, entityId });

    entityChangesService.addEntityChangeWithInstanceId(entityChange, instanceId);
}

module.exports = {
    updateEntity
};
