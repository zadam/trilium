const sql = require('./sql');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events');
const entityConstructor = require('../entities/entity_constructor');

function updateEntity(entityChange, entity, sourceId) {
    // can be undefined for options with isSynced=false
    if (!entity) {
        return;
    }

    const updated = entityChange.entityName === 'note_reordering'
        ? updateNoteReordering(entityChange, entity, sourceId)
        : updateNormalEntity(entityChange, entity, sourceId);

    // currently making exception for protected notes and note revisions because here
    // the title and content are not available decrypted as listeners would expect
    if (updated && !entity.isProtected && !entityChange.isErased) {
        eventService.emit(eventService.ENTITY_SYNCED, {
            entityName: entityChange.entityName,
            entity
        });
    }
}

function updateNormalEntity(entityChange, entity, sourceId) {
    const {utcDateChanged, hash, isErased} = sql.getRow(`
        SELECT utcDateChanged, hash, isErased
        FROM entity_changes 
        WHERE entityName = ? AND entityId = ?`, [entityChange.entityName, entityChange.entityId]);

    if (!isErased && entityChange.isErased) {
        sql.transactional(() => {
            const primaryKey = entityConstructor.getEntityFromEntityName(entityName).primaryKeyName;

            sql.execute(`DELETE FROM ${entityChange.entityName} WHERE ${primaryKey} = ?`, entityChange.entityId);

            entityChangesService.addEntityChange(entityChange, sourceId);
        });

        return true;
    }

    if (utcDateChanged < entityChange.utcDateChanged
        || hash !== entityChange.hash // sync error, we should still update
    ) {
        if (['note_contents', 'note_revision_contents'].includes(entityChange.entityName)) {
            entity.content = handleContent(entity.content);
        }

        sql.transactional(() => {
            sql.replace(entityChange.entityName, entity);

            entityChangesService.addEntityChange(entityChange, sourceId);
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
