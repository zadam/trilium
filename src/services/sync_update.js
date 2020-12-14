const sql = require('./sql');
const log = require('./log');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events');

function updateEntity(entityChange, entity, sourceId) {
    // can be undefined for options with isSynced=false
    if (!entity) {
        return false;
    }

    const {entityName, hash} = entityChange;
    let updated;

    if (entityName === 'note_reordering') {
        updated = updateNoteReordering(entityChange, entity, sourceId);
    }
    else {
        updated = updateNormalEntity(entityChange, entity, sourceId);
    }

    // currently making exception for protected notes and note revisions because here
    // the title and content are not available decrypted as listeners would expect
    if (updated &&
        (!['notes', 'note_contents', 'note_revisions', 'note_revision_contents'].includes(entityName) || !entity.isProtected)) {
        eventService.emit(eventService.ENTITY_SYNCED, {
            entityName,
            entity
        });
    }

    return updated;
}

function updateNormalEntity(entityChange, entity, sourceId) {
    const {utcDateChanged, hash} = sql.getRow(`
        SELECT utcDateChanged, hash 
        FROM entity_changes 
        WHERE entityName = ? AND entityId = ?`, [entityChange.entityName, entityChange.entityId]);

    if (utcDateChanged < entityChange.utcDateChanged
        || hash !== entityChange.hash // sync error, we should still update
    ) {
        if (['note_contents', 'note_revision_contents'].includes(entityChange.entityName)) {
            // we always use Buffer object which is different from normal saving - there we use simple string type for "string notes"
            // the problem is that in general it's not possible to whether a note_content is string note or note (syncs can arrive out of order)
            entity.content = entity.content === null ? null : Buffer.from(entity.content, 'base64');

            if (entity.content && entity.content.byteLength === 0) {
                // there seems to be a bug which causes empty buffer to be stored as NULL which is then picked up as inconsistency
                entity.content = "";
            }
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

module.exports = {
    updateEntity
};
