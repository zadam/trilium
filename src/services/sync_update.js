const sql = require('./sql');
const log = require('./log');
const eventLogService = require('./event_log');
const syncTableService = require('./sync_table');

function deserializeNoteContentBuffer(note) {
    if (note.type === 'file') {
        note.content = new Buffer(note.content, 'binary');
    }
}

async function updateNote(entity, sourceId) {
    deserializeNoteContentBuffer(entity);

    const origNote = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [entity.noteId]);

    if (!origNote || origNote.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await syncTableService.addNoteSync(entity.noteId, sourceId);
            await eventLogService.addNoteEvent(entity.noteId, "Synced note <note>");
        });

        log.info("Update/sync note " + entity.noteId);
    }
}

async function updateBranch(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM branches WHERE branchId = ?", [entity.branchId]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.dateModified < entity.dateModified) {
            delete entity.isExpanded;

            await sql.replace('branches', entity);

            await syncTableService.addBranchSync(entity.branchId, sourceId);

            log.info("Update/sync note tree " + entity.branchId);
        }
    });
}

async function updateNoteRevision(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [entity.noteRevisionId]);

    await sql.doInTransaction(async () => {
        // we update note revision even if date modified to is the same because the only thing which might have changed
        // is the protected status (and correnspondingly title and content) which doesn't affect the dateModifiedTo
        if (orig === null || orig.dateModifiedTo <= entity.dateModifiedTo) {
            await sql.replace('note_revisions', entity);

            await syncTableService.addNoteRevisionSync(entity.noteRevisionId, sourceId);

            log.info("Update/sync note revision " + entity.noteRevisionId);
        }
    });
}

async function updateNoteReordering(entity, sourceId) {
    await sql.doInTransaction(async () => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?", [entity.ordering[key], key]);
        });

        await syncTableService.addNoteReorderingSync(entity.parentNoteId, sourceId);
    });
}

async function updateOptions(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM options WHERE name = ?", [entity.name]);

    if (!orig.isSynced) {
        return;
    }

    await sql.doInTransaction(async () => {
        if (orig === null || orig.dateModified < entity.dateModified) {
            await sql.replace('options', entity);

            await syncTableService.addOptionsSync(entity.name, sourceId);

            await eventLogService.addEvent("Synced option " + entity.name);
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM recent_notes WHERE branchId = ?", [entity.branchId]);

    if (orig === null || orig.dateAccessed < entity.dateAccessed) {
        await sql.doInTransaction(async () => {
            await sql.replace('recent_notes', entity);

            await syncTableService.addRecentNoteSync(entity.branchId, sourceId);
        });
    }
}

async function updateImage(entity, sourceId) {
    if (entity.data !== null) {
        entity.data = Buffer.from(entity.data, 'base64');
    }

    const origImage = await sql.getRow("SELECT * FROM images WHERE imageId = ?", [entity.imageId]);

    if (!origImage || origImage.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("images", entity);

            await syncTableService.addImageSync(entity.imageId, sourceId);
        });

        log.info("Update/sync image " + entity.imageId);
    }
}

async function updateNoteImage(entity, sourceId) {
    const origNoteImage = await sql.getRow("SELECT * FROM note_images WHERE noteImageId = ?", [entity.noteImageId]);

    if (!origNoteImage || origNoteImage.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("note_images", entity);

            await syncTableService.addNoteImageSync(entity.noteImageId, sourceId);
        });

        log.info("Update/sync note image " + entity.noteImageId);
    }
}

async function updateLabel(entity, sourceId) {
    const origLabel = await sql.getRow("SELECT * FROM labels WHERE labelId = ?", [entity.labelId]);

    if (!origLabel || origLabel.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("labels", entity);

            await syncTableService.addLabelSync(entity.labelId, sourceId);
        });

        log.info("Update/sync label " + entity.labelId);
    }
}

async function updateApiToken(entity, sourceId) {
    const apiTokenId = await sql.getRow("SELECT * FROM api_tokens WHERE apiTokenId = ?", [entity.apiTokenId]);

    if (!apiTokenId) {
        await sql.doInTransaction(async () => {
            await sql.replace("api_tokens", entity);

            await syncTableService.addApiTokenSync(entity.apiTokenId, sourceId);
        });

        log.info("Update/sync API token " + entity.apiTokenId);
    }
}

module.exports = {
    updateNote,
    updateBranch,
    updateNoteRevision,
    updateNoteReordering,
    updateOptions,
    updateRecentNotes,
    updateImage,
    updateNoteImage,
    updateLabel,
    updateApiToken
};