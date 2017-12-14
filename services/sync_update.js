const sql = require('./sql');
const log = require('./log');
const options = require('./options');
const eventLog = require('./event_log');
const notes = require('./notes');
const sync_table = require('./sync_table');

async function updateNote(entity, sourceId) {
    const origNote = await sql.getSingleResult("SELECT * FROM notes WHERE note_id = ?", [entity.note_id]);

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
    const orig = await sql.getSingleResultOrNull("SELECT * FROM notes_tree WHERE note_tree_id = ?", [entity.note_tree_id]);

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
    const orig = await sql.getSingleResultOrNull("SELECT * FROM notes_history WHERE note_history_id = ?", [entity.note_history_id]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.date_modified_to < entity.date_modified_to) {
            await sql.replace('notes_history', entity);

            await sync_table.addNoteHistorySync(entity.note_history_id, sourceId);

            log.info("Update/sync note history " + entity.note_history_id);
        }
    });
}

async function updateNoteReordering(entity, sourceId) {
    await sql.doInTransaction(async () => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute("UPDATE notes_tree SET note_pos = ? WHERE note_tree_id = ?", [entity.ordering[key], key]);
        });

        await sync_table.addNoteReorderingSync(entity.note_pid, sourceId);
    });
}

async function updateOptions(entity, sourceId) {
    if (!options.SYNCED_OPTIONS.includes(entity.opt_name)) {
        return;
    }

    const orig = await sql.getSingleResultOrNull("SELECT * FROM options WHERE opt_name = ?", [entity.opt_name]);

    await sql.doInTransaction(async () => {
        if (orig === null || orig.date_modified < entity.date_modified) {
            await sql.replace('options', entity);

            await sync_table.addOptionsSync(entity.opt_name, sourceId);

            await eventLog.addEvent("Synced option " + entity.opt_name);
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getSingleResultOrNull("SELECT * FROM recent_notes WHERE note_tree_id = ?", [entity.note_tree_id]);

    if (orig === null || orig.date_accessed < entity.date_accessed) {
        await sql.doInTransaction(async () => {
            await sql.replace('recent_notes', entity);

            await sync_table.addRecentNoteSync(entity.note_tree_id, sourceId);
        });
    }
}

module.exports = {
    updateNote,
    updateNoteTree,
    updateNoteHistory,
    updateNoteReordering,
    updateOptions,
    updateRecentNotes
};