const sql = require('./sql');
const log = require('./log');
const syncTableService = require('./sync_table');
const eventService = require('./events');

function updateEntity(sync, entity, sourceId) {
    // can be undefined for options with isSynced=false
    if (!entity) {
        return false;
    }

    const {entityName} = sync;
    let updated;

    if (entityName === 'notes') {
        updated = updateNote(entity, sourceId);
    }
    else if (entityName === 'note_contents') {
        updated = updateNoteContent(entity, sourceId);
    }
    else if (entityName === 'branches') {
        updated = updateBranch(entity, sourceId);
    }
    else if (entityName === 'note_revisions') {
        updated = updateNoteRevision(entity, sourceId);
    }
    else if (entityName === 'note_revision_contents') {
        updated = updateNoteRevisionContent(entity, sourceId);
    }
    else if (entityName === 'note_reordering') {
        updated = updateNoteReordering(sync.entityId, entity, sourceId);
    }
    else if (entityName === 'options') {
        updated = updateOptions(entity, sourceId);
    }
    else if (entityName === 'recent_notes') {
        updated = updateRecentNotes(entity, sourceId);
    }
    else if (entityName === 'attributes') {
        updated = updateAttribute(entity, sourceId);
    }
    else if (entityName === 'api_tokens') {
        updated = updateApiToken(entity, sourceId);
    }
    else {
        throw new Error(`Unrecognized entity type ${entityName}`);
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

function shouldWeUpdateEntity(localEntity, remoteEntity) {
    if (!localEntity) {
        return true;
    }

    const localDate = localEntity.utcDateModified || localEntity.utcDateCreated;
    const remoteDate = remoteEntity.utcDateModified || remoteEntity.utcDateCreated;

    if (localDate < remoteDate) {
        return true;
    }

    // this can happen in case of sync error when hashes are different but dates are the same - we should still update
    if (localEntity.hash !== remoteEntity.hash && localDate === remoteDate) {
        return true;
    }

    return false;
}

function updateNote(remoteEntity, sourceId) {
    const localEntity = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [remoteEntity.noteId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            sql.replace("notes", remoteEntity);

            syncTableService.addNoteSync(remoteEntity.noteId, sourceId);
        });

        return true;
    }

    return false;
}

function updateNoteContent(remoteEntity, sourceId) {
    const localEntity = sql.getRow("SELECT * FROM note_contents WHERE noteId = ?", [remoteEntity.noteId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        remoteEntity.content = remoteEntity.content === null ? null : Buffer.from(remoteEntity.content, 'base64');

        sql.transactional(() => {
            sql.replace("note_contents", remoteEntity);

            syncTableService.addNoteContentSync(remoteEntity.noteId, sourceId);
        });

        return true;
    }

    return false;
}

function updateBranch(remoteEntity, sourceId) {
    const localEntity = sql.getRowOrNull("SELECT * FROM branches WHERE branchId = ?", [remoteEntity.branchId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            // isExpanded is not synced unless it's a new branch instance
            // otherwise in case of full new sync we'll get all branches (even root) collapsed.
            if (localEntity) {
                delete remoteEntity.isExpanded;
            }

            sql.replace('branches', remoteEntity);

            syncTableService.addBranchSync(remoteEntity.branchId, sourceId);
        });

        return true;
    }

    return false;
}

function updateNoteRevision(remoteEntity, sourceId) {
    const localEntity = sql.getRowOrNull("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [remoteEntity.noteRevisionId]);

    sql.transactional(() => {
        if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
            sql.replace('note_revisions', remoteEntity);

            syncTableService.addNoteRevisionSync(remoteEntity.noteRevisionId, sourceId);

            log.info("Update/sync note revision " + remoteEntity.noteRevisionId);
        }
    });
}

function updateNoteRevisionContent(remoteEntity, sourceId) {
    const localEntity = sql.getRowOrNull("SELECT * FROM note_revision_contents WHERE noteRevisionId = ?", [remoteEntity.noteRevisionId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            remoteEntity.content = remoteEntity.content === null ? null : Buffer.from(remoteEntity.content, 'base64');

            sql.replace('note_revision_contents', remoteEntity);

            syncTableService.addNoteRevisionContentSync(remoteEntity.noteRevisionId, sourceId);
        });

        return true;
    }

    return false;
}

function updateNoteReordering(entityId, remote, sourceId) {
    sql.transactional(() => {
        for (const key in remote) {
            sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [remote[key], key]);
        }

        syncTableService.addNoteReorderingSync(entityId, sourceId);
    });

    return true;
}

function updateOptions(remoteEntity, sourceId) {
    const localEntity = sql.getRowOrNull("SELECT * FROM options WHERE name = ?", [remoteEntity.name]);

    if (localEntity && !localEntity.isSynced) {
        return;
    }

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            sql.replace('options', remoteEntity);

            syncTableService.addOptionsSync(remoteEntity.name, sourceId, true);
        });

        return true;
    }

    return false;
}

function updateRecentNotes(remoteEntity, sourceId) {
    const localEntity = sql.getRowOrNull("SELECT * FROM recent_notes WHERE noteId = ?", [remoteEntity.noteId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            sql.replace('recent_notes', remoteEntity);

            syncTableService.addRecentNoteSync(remoteEntity.noteId, sourceId);
        });

        return true;
    }

    return false;
}

function updateAttribute(remoteEntity, sourceId) {
    const localEntity = sql.getRow("SELECT * FROM attributes WHERE attributeId = ?", [remoteEntity.attributeId]);

    if (shouldWeUpdateEntity(localEntity, remoteEntity)) {
        sql.transactional(() => {
            sql.replace("attributes", remoteEntity);

            syncTableService.addAttributeSync(remoteEntity.attributeId, sourceId);
        });

        return true;
    }

    return false;
}

function updateApiToken(entity, sourceId) {
    const apiTokenId = sql.getRow("SELECT * FROM api_tokens WHERE apiTokenId = ?", [entity.apiTokenId]);

    if (!apiTokenId) {
        sql.transactional(() => {
            sql.replace("api_tokens", entity);

            syncTableService.addApiTokenSync(entity.apiTokenId, sourceId);
        });

        return true;
    }

    return false;
}

module.exports = {
    updateEntity
};
