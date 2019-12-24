const sql = require('./sql');
const log = require('./log');
const syncTableService = require('./sync_table');
const eventService = require('./events');

async function updateEntity(sync, entity, sourceId) {
    const {entityName} = sync;

    if (entityName === 'notes') {
        await updateNote(entity, sourceId);
    }
    else if (entityName === 'note_contents') {
        await updateNoteContent(entity, sourceId);
    }
    else if (entityName === 'branches') {
        await updateBranch(entity, sourceId);
    }
    else if (entityName === 'note_revisions') {
        await updateNoteRevision(entity, sourceId);
    }
    else if (entityName === 'note_revision_contents') {
        await updateNoteRevisionContent(entity, sourceId);
    }
    else if (entityName === 'note_reordering') {
        await updateNoteReordering(sync.entityId, entity, sourceId);
    }
    else if (entityName === 'options') {
        await updateOptions(entity, sourceId);
    }
    else if (entityName === 'recent_notes') {
        await updateRecentNotes(entity, sourceId);
    }
    else if (entityName === 'attributes') {
        await updateAttribute(entity, sourceId);
    }
    else if (entityName === 'api_tokens') {
        await updateApiToken(entity, sourceId);
    }
    else {
        throw new Error(`Unrecognized entity type ${entityName}`);
    }

    // currently making exception for protected notes and note revisions because here
    // the title and content are not available decrypted as listeners would expect
    if (!['notes', 'note_contents', 'note_revisions', 'note_revision_contents'].includes(entityName) || !entity.isProtected) {
        await eventService.emit(eventService.ENTITY_SYNCED, {
            entityName,
            entity
        });
    }
}

async function updateNote(entity, sourceId) {
    const origNote = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [entity.noteId]);

    if (!origNote || origNote.utcDateModified < entity.utcDateModified || origNote.hash !== entity.hash) {
        await sql.transactional(async () => {
            await sql.replace("notes", entity);

            await syncTableService.addNoteSync(entity.noteId, sourceId);
        });

        log.info("Update/sync note " + entity.noteId);
    }
}

async function updateNoteContent(entity, sourceId) {
    const origNoteContent = await sql.getRow("SELECT * FROM note_contents WHERE noteId = ?", [entity.noteId]);

    if (!origNoteContent || origNoteContent.utcDateModified < entity.utcDateModified || origNoteContent.hash !== entity.hash) {
        entity.content = entity.content === null ? null : Buffer.from(entity.content, 'base64');

        await sql.transactional(async () => {
            await sql.replace("note_contents", entity);

            await syncTableService.addNoteContentSync(entity.noteId, sourceId);
        });

        log.info("Update/sync note content for noteId=" + entity.noteId);
    }
}

async function updateBranch(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM branches WHERE branchId = ?", [entity.branchId]);

    await sql.transactional(async () => {
        if (orig === null || orig.utcDateModified < entity.utcDateModified || orig.hash !== entity.hash) {
            // isExpanded is not synced unless it's a new branch instance
            // otherwise in case of full new sync we'll get all branches (even root) collapsed.
            if (orig) {
                delete entity.isExpanded;
            }

            await sql.replace('branches', entity);

            await syncTableService.addBranchSync(entity.branchId, sourceId);

            log.info("Update/sync branch " + entity.branchId);
        }
    });
}

async function updateNoteRevision(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [entity.noteRevisionId]);

    await sql.transactional(async () => {
        if (orig === null || orig.utcDateModified < entity.utcDateModified || orig.hash !== entity.hash) {
            await sql.replace('note_revisions', entity);

            await syncTableService.addNoteRevisionSync(entity.noteRevisionId, sourceId);

            log.info("Update/sync note revision " + entity.noteRevisionId);
        }
    });
}

async function updateNoteRevisionContent(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM note_revision_contents WHERE noteRevisionId = ?", [entity.noteRevisionId]);

    await sql.transactional(async () => {
        if (orig === null || orig.utcDateModified < entity.utcDateModified || orig.hash !== entity.hash) {
            entity.content = entity.content === null ? null : Buffer.from(entity.content, 'base64');

            await sql.replace('note_revision_contents', entity);

            await syncTableService.addNoteRevisionContentSync(entity.noteRevisionId, sourceId);

            log.info("Update/sync note revision content " + entity.noteRevisionId);
        }
    });
}

async function updateNoteReordering(entityId, entity, sourceId) {
    await sql.transactional(async () => {
        for (const key in entity) {
            await sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [entity[key], key]);
        }

        await syncTableService.addNoteReorderingSync(entityId, sourceId);
    });
}

async function updateOptions(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM options WHERE name = ?", [entity.name]);

    if (orig && !orig.isSynced) {
        return;
    }

    await sql.transactional(async () => {
        if (orig === null || orig.utcDateModified < entity.utcDateModified || orig.hash !== entity.hash) {
            await sql.replace('options', entity);

            await syncTableService.addOptionsSync(entity.name, sourceId);
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM recent_notes WHERE noteId = ?", [entity.noteId]);

    if (orig === null || orig.utcDateCreated < entity.utcDateCreated || orig.hash !== entity.hash) {
        await sql.transactional(async () => {
            await sql.replace('recent_notes', entity);

            await syncTableService.addRecentNoteSync(entity.noteId, sourceId);
        });
    }
}

async function updateAttribute(entity, sourceId) {
    const origAttribute = await sql.getRow("SELECT * FROM attributes WHERE attributeId = ?", [entity.attributeId]);

    if (!origAttribute || origAttribute.utcDateModified <= entity.utcDateModified || origAttribute.hash !== entity.hash) {
        await sql.transactional(async () => {
            await sql.replace("attributes", entity);

            await syncTableService.addAttributeSync(entity.attributeId, sourceId);
        });

        log.info("Update/sync attribute " + entity.attributeId);
    }
}

async function updateApiToken(entity, sourceId) {
    const apiTokenId = await sql.getRow("SELECT * FROM api_tokens WHERE apiTokenId = ?", [entity.apiTokenId]);

    if (!apiTokenId) {
        await sql.transactional(async () => {
            await sql.replace("api_tokens", entity);

            await syncTableService.addApiTokenSync(entity.apiTokenId, sourceId);
        });

        log.info("Update/sync API token " + entity.apiTokenId);
    }
}

module.exports = {
    updateEntity
};