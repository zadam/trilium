const sql = require('./sql');
const log = require('./log');
const entityChangesService = require('./entity_changes');
const eventService = require('./events');
const entityConstructor = require("../becca/entity_constructor");

function updateEntity(remoteEC, remoteEntityRow, instanceId) {
    if (!remoteEntityRow && remoteEC.entityName === 'options') {
        return; // can be undefined for options with isSynced=false
    }

    const updated = remoteEC.entityName === 'note_reordering'
        ? updateNoteReordering(remoteEC, remoteEntityRow, instanceId)
        : updateNormalEntity(remoteEC, remoteEntityRow, instanceId);

    if (updated) {
        if (remoteEntityRow?.isDeleted) {
            eventService.emit(eventService.ENTITY_DELETE_SYNCED, {
                entityName: remoteEC.entityName,
                entityId: remoteEC.entityId
            });
        }
        else if (!remoteEC.isErased) {
            eventService.emit(eventService.ENTITY_CHANGE_SYNCED, {
                entityName: remoteEC.entityName,
                entityRow: remoteEntityRow
            });
        }
    }
}

function updateNormalEntity(remoteEC, remoteEntityRow, instanceId) {
    const localEC = sql.getRow(`SELECT * FROM entity_changes WHERE entityName = ? AND entityId = ?`, [remoteEC.entityName, remoteEC.entityId]);

    if (!localEC?.isErased && remoteEC.isErased) {
        eraseEntity(remoteEC, instanceId);

        return true;
    } else if (localEC?.isErased && !remoteEC.isErased) {
        // on this side, we can't unerase the entity, so force the entity to be erased on the other side.
        entityChangesService.addEntityChangeWithInstanceId(localEC, null);

        return false;
    }

    if (!localEC
        || localEC.utcDateChanged < remoteEC.utcDateChanged
        || (localEC.utcDateChanged === remoteEC.utcDateChanged && localEC.hash !== remoteEC.hash) // sync error, we should still update
    ) {
        if (remoteEC.entityName === 'blobs' && remoteEntityRow.content !== null) {
            // we always use a Buffer object which is different from normal saving - there we use a simple string type for
            // "string notes". The problem is that in general, it's not possible to detect whether a blob content
            // is string note or note (syncs can arrive out of order)
            remoteEntityRow.content = Buffer.from(remoteEntityRow.content, 'base64');

            if (remoteEntityRow.content.byteLength === 0) {
                // there seems to be a bug which causes empty buffer to be stored as NULL which is then picked up as inconsistency
                // (possibly not a problem anymore with the newer better-sqlite3)
                remoteEntityRow.content = "";
            }
        }

        sql.replace(remoteEC.entityName, remoteEntityRow);

        entityChangesService.addEntityChangeWithInstanceId(remoteEC, instanceId);

        return true;
    } else if (localEC.hash !== remoteEC.hash && localEC.utcDateChanged > remoteEC.utcDateChanged) {
        // the change on our side is newer than on the other side, so the other side should update
        entityChangesService.addEntityChangeWithInstanceId(localEC, null);

        return false;
    }

    return false;
}

function updateNoteReordering(remoteEC, remoteEntityRow, instanceId) {
    for (const key in remoteEntityRow) {
        sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [remoteEntityRow[key], key]);
    }

    entityChangesService.addEntityChangeWithInstanceId(remoteEC, instanceId);

    return true;
}

function eraseEntity(entityChange, instanceId) {
    const {entityName, entityId} = entityChange;

    const entityNames = [
        "notes",
        "branches",
        "attributes",
        "revisions",
        "attachments",
        "blobs"
    ];

    if (!entityNames.includes(entityName)) {
        log.error(`Cannot erase entity '${entityName}', id '${entityId}'.`);
        return;
    }

    const primaryKeyName = entityConstructor.getEntityFromEntityName(entityName).primaryKeyName;

    sql.execute(`DELETE FROM ${entityName} WHERE ${primaryKeyName} = ?`, [entityId]);

    entityChangesService.addEntityChangeWithInstanceId(entityChange, instanceId);
}

module.exports = {
    updateEntity
};
