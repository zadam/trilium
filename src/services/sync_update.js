const sql = require('./sql');
const log = require('./log');
const eventLog = require('./event_log');
const notes = require('./notes');
const sync_table = require('./sync_table');

async function updateNote(entity, sourceId) {
    const origNote = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [entity.noteId]);

    if (!origNote || origNote.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await sync_table.addNoteSync(entity.noteId, sourceId);
            await eventLog.addNoteEvent(entity.noteId, "Synced note <note>");
        });

        log.info("Update/sync note " + entity.noteId);
    }
}

async function updateNoteTree(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM note_tree WHERE noteTreeId = ?", [entity.noteTreeId]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.dateModified < entity.dateModified) {
            delete entity.isExpanded;

            await sql.replace('note_tree', entity);

            await sync_table.addNoteTreeSync(entity.noteTreeId, sourceId);

            log.info("Update/sync note tree " + entity.noteTreeId);
        }
    });
}

async function updateNoteHistory(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [entity.noteRevisionId]);

    await sql.doInTransaction(async () => {
        // we update note history even if date modified to is the same because the only thing which might have changed
        // is the protected status (and correnspondingly title and content) which doesn't affect the dateModifiedTo
        if (orig === null || orig.dateModifiedTo <= entity.dateModifiedTo) {
            await sql.replace('note_revisions', entity);

            await sync_table.addNoteHistorySync(entity.noteRevisionId, sourceId);

            log.info("Update/sync note history " + entity.noteRevisionId);
        }
    });
}

async function updateNoteReordering(entity, sourceId) {
    await sql.doInTransaction(async () => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute("UPDATE note_tree SET notePosition = ? WHERE noteTreeId = ?", [entity.ordering[key], key]);
        });

        await sync_table.addNoteReorderingSync(entity.parentNoteId, sourceId);
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

            await sync_table.addOptionsSync(entity.name, sourceId);

            await eventLog.addEvent("Synced option " + entity.name);
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getRowOrNull("SELECT * FROM recent_notes WHERE noteTreeId = ?", [entity.noteTreeId]);

    if (orig === null || orig.dateAccessed < entity.dateAccessed) {
        await sql.doInTransaction(async () => {
            await sql.replace('recent_notes', entity);

            await sync_table.addRecentNoteSync(entity.noteTreeId, sourceId);
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

            await sync_table.addImageSync(entity.imageId, sourceId);
        });

        log.info("Update/sync image " + entity.imageId);
    }
}

async function updateNoteImage(entity, sourceId) {
    const origNoteImage = await sql.getRow("SELECT * FROM note_images WHERE noteImageId = ?", [entity.noteImageId]);

    if (!origNoteImage || origNoteImage.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("note_images", entity);

            await sync_table.addNoteImageSync(entity.noteImageId, sourceId);
        });

        log.info("Update/sync note image " + entity.noteImageId);
    }
}

async function updateAttribute(entity, sourceId) {
    const origAttribute = await sql.getRow("SELECT * FROM attributes WHERE attributeId = ?", [entity.attributeId]);

    if (!origAttribute || origAttribute.dateModified <= entity.dateModified) {
        await sql.doInTransaction(async () => {
            await sql.replace("attributes", entity);

            await sync_table.addAttributeSync(entity.attributeId, sourceId);
        });

        log.info("Update/sync attribute " + entity.attributeId);
    }
}

module.exports = {
    updateNote,
    updateNoteTree,
    updateNoteHistory,
    updateNoteReordering,
    updateOptions,
    updateRecentNotes,
    updateImage,
    updateNoteImage,
    updateAttribute
};