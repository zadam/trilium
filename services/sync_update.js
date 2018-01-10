const sql = require('./sql');
const log = require('./log');
const options = require('./options');
const eventLog = require('./event_log');
const notes = require('./notes');
const sync_table = require('./sync_table');

async function updateNote(entity, sourceId) {
    const origNote = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [entity.note_id]);

    if (!origNote || origNote.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes", entity);

            await sync_table.addNoteSync(entity.note_id, sourceId);
            await eventLog.addNoteEvent(entity.note_id, "Synced note <note>");
        });

        log.info("Update/sync note " + entity.note_id);
    }
}

async function updateNoteTree(entity, sourceId) {
    const orig = await sql.getFirstOrNull("SELECT * FROM notes_tree WHERE note_tree_id = ?", [entity.note_tree_id]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.date_modified < entity.date_modified) {
            delete entity.is_expanded;

            await sql.replace('notes_tree', entity);

            await sync_table.addNoteTreeSync(entity.note_tree_id, sourceId);

            log.info("Update/sync note tree " + entity.note_tree_id);
        }
    });
}

async function updateNoteHistory(entity, sourceId) {
    const orig = await sql.getFirstOrNull("SELECT * FROM notes_history WHERE note_history_id = ?", [entity.note_history_id]);

    await sql.doInTransaction(async () => {
        // we update note history even if date modified to is the same because the only thing which might have changed
        // is the protected status (and correnspondingly note_title and note_text) which doesn't affect the date_modified_to
        if (orig === null || orig.date_modified_to <= entity.date_modified_to) {
            await sql.replace('notes_history', entity);

            await sync_table.addNoteHistorySync(entity.note_history_id, sourceId);

            log.info("Update/sync note history " + entity.note_history_id);
        }
    });
}

async function updateNoteReordering(entity, sourceId) {
    await sql.doInTransaction(async () => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute("UPDATE notes_tree SET note_position = ? WHERE note_tree_id = ?", [entity.ordering[key], key]);
        });

        await sync_table.addNoteReorderingSync(entity.parent_note_id, sourceId);
    });
}

async function updateOptions(entity, sourceId) {
    if (!options.SYNCED_OPTIONS.includes(entity.opt_name)) {
        return;
    }

    const orig = await sql.getFirstOrNull("SELECT * FROM options WHERE opt_name = ?", [entity.opt_name]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.date_modified < entity.date_modified) {
            await sql.replace('options', entity);

            await sync_table.addOptionsSync(entity.opt_name, sourceId);

            await eventLog.addEvent("Synced option " + entity.opt_name);
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getFirstOrNull("SELECT * FROM recent_notes WHERE note_tree_id = ?", [entity.note_tree_id]);

    if (orig === null || orig.date_accessed < entity.date_accessed) {
        await sql.doInTransaction(async () => {
            await sql.replace('recent_notes', entity);

            await sync_table.addRecentNoteSync(entity.note_tree_id, sourceId);
        });
    }
}

async function updateImage(entity, sourceId) {
    if (entity.data !== null) {
        entity.data = Buffer.from(entity.data, 'base64');
    }

    const origImage = await sql.getFirst("SELECT * FROM images WHERE image_id = ?", [entity.image_id]);

    if (!origImage || origImage.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("images", entity);

            await sync_table.addImageSync(entity.image_id, sourceId);
        });

        log.info("Update/sync image " + entity.image_id);
    }
}

async function updateNoteImage(entity, sourceId) {
    const origNoteImage = await sql.getFirst("SELECT * FROM notes_image WHERE note_image_id = ?", [entity.note_image_id]);

    if (!origNoteImage || origNoteImage.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("notes_image", entity);

            await sync_table.addNoteImageSync(entity.note_image_id, sourceId);
        });

        log.info("Update/sync note image " + entity.note_image_id);
    }
}

async function updateAttribute(entity, sourceId) {
    const origAttribute = await sql.getFirst("SELECT * FROM attribute WHERE attribute_id = ?", [entity.attribute_id]);

    if (!origAttribute || origAttribute.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async () => {
            await sql.replace("attribute", entity);

            await sync_table.addAttributeSync(entity.attribute_id, sourceId);
        });

        log.info("Update/sync attribute " + entity.attribute_id);
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