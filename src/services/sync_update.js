const sql = require('./sql');
const log = require('./log');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events');
const entityConstructor = require("./becca/entity_constructor.js");

function updateEntity(entityChange, entity, sourceId) {
    // can be undefined for options with isSynced=false
    if (!entity) {
        if (entityChange.isSynced) {
            if (entityChange.isErased) {
                entityChangesService.addEntityChange(entityChange, sourceId);
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
        ? updateNoteReordering(entityChange, entity, sourceId)
        : updateNormalEntity(entityChange, entity, sourceId);

    if (updated && !entityChange.isErased) {
        if (entity.isDeleted) {
            eventService.emit(eventService.ENTITY_DELETE_SYNCED, {
                entityName: entityChange.entityName,
                entityId: entityChange.entityId
            });
        }
        else {
            eventService.emit(eventService.ENTITY_CHANGE_SYNCED, {
                entityName: entityChange.entityName,
                entity
            });
        }
    }
}

function updateNormalEntity(remoteEntityChange, entity, sourceId) {
    const localEntityChange = sql.getRow(`
        SELECT utcDateChanged, hash, isErased
        FROM entity_changes 
        WHERE entityName = ? AND entityId = ?`, [remoteEntityChange.entityName, remoteEntityChange.entityId]);

    if (localEntityChange && !localEntityChange.isErased && remoteEntityChange.isErased) {
        sql.transactional(() => {
            const primaryKey = entityConstructor.getEntityFromEntityName(remoteEntityChange.entityName).primaryKeyName;

            sql.execute(`DELETE FROM ${remoteEntityChange.entityName} WHERE ${primaryKey} = ?`, remoteEntityChange.entityId);

            entityChangesService.addEntityChange(remoteEntityChange, sourceId);
        });

        return true;
    }

    if (!localEntityChange
        || localEntityChange.utcDateChanged < remoteEntityChange.utcDateChanged
        || localEntityChange.hash !== remoteEntityChange.hash // sync error, we should still update
    ) {
        if (['note_contents', 'note_revision_contents'].includes(remoteEntityChange.entityName)) {
            entity.content = handleContent(entity.content);
        }

        sql.transactional(() => {
            sql.replace(remoteEntityChange.entityName, entity);

            entityChangesService.addEntityChange(remoteEntityChange, sourceId);
        });

        return true;
    }

    return false;
}

function updateNoteReordering(entityChange, entity, sourceId) {
    sql.transactional(() => {
        for (const key in entity) {
            sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [entity[key], key]);
        }

        entityChangesService.addEntityChange(entityChange, sourceId);
    });

    return true;
}

function handleContent(content) {
    // we always use Buffer object which is different from normal saving - there we use simple string type for "string notes"
    // the problem is that in general it's not possible to whether a note_content is string note or note (syncs can arrive out of order)
    content = content === null ? null : Buffer.from(content, 'base64');

    if (content && content.byteLength === 0) {
        // there seems to be a bug which causes empty buffer to be stored as NULL which is then picked up as inconsistency
        content = "";
    }

    return content;
}

module.exports = {
    updateEntity
};
