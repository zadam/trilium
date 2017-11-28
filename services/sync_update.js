const sql = require('./sql');
const log = require('./log');
const options = require('./options');
const utils = require('./utils');
const eventLog = require('./event_log');
const notes = require('./notes');
const sync_table = require('./sync_table');

async function updateNote(entity, links, sourceId) {
    const origNote = await sql.getSingleResult("SELECT * FROM notes WHERE note_id = ?", [entity.note_id]);

    if (!origNote || origNote.date_modified <= entity.date_modified) {
        await sql.doInTransaction(async db => {
            await sql.replace(db, "notes", entity);

            await sql.remove(db, "links", entity.note_id);

            for (const link of links) {
                delete link['lnk_id'];

                //await sql.insert(db, 'link', link);
            }

            await sync_table.addNoteSync(db, entity.note_id, sourceId);
            await eventLog.addNoteEvent(db, entity.note_id, "Synced note <note>");
        });

        log.info("Update/sync note " + entity.note_id);
    }
    else {
        await eventLog.addNoteEvent(db, entity.note_id, "Sync conflict in note <note>, " + utils.formatTwoTimestamps(origNote.date_modified, entity.date_modified));
    }
}

async function updateNoteTree(entity, sourceId) {
    const orig = await sql.getSingleResultOrNull("SELECT * FROM notes_tree WHERE note_tree_id = ?", [entity.note_tree_id]);

    await sql.doInTransaction(async db => {
        if (orig === null || orig.date_modified < entity.date_modified) {
            delete entity.is_expanded;

            await sql.replace(db, 'notes_tree', entity);

            await sync_table.addNoteTreeSync(db, entity.note_tree_id, sourceId);

            log.info("Update/sync note tree " + entity.note_tree_id);
        }
        else {
            await eventLog.addNoteEvent(db, entity.note_tree_id, "Sync conflict in note tree <note>, " + utils.formatTwoTimestamps(orig.date_modified, entity.date_modified));
        }
    });
}

async function updateNoteHistory(entity, sourceId) {
    const orig = await sql.getSingleResultOrNull("SELECT * FROM notes_history WHERE note_history_id = ?", [entity.note_history_id]);

    await sql.doInTransaction(async db => {
        if (orig === null || orig.date_modified_to < entity.date_modified_to) {
            await sql.replace(db, 'notes_history', entity);

            await sync_table.addNoteHistorySync(db, entity.note_history_id, sourceId);

            log.info("Update/sync note history " + entity.note_history_id);
        }
        else {
            await eventLog.addNoteEvent(db, entity.note_id, "Sync conflict in note history for <note>, " + utils.formatTwoTimestamps(orig.date_modified_to, entity.date_modified_to));
        }
    });
}

async function updateNoteReordering(entity, sourceId) {
    await sql.doInTransaction(async db => {
        Object.keys(entity.ordering).forEach(async key => {
            await sql.execute(db, "UPDATE notes_tree SET note_pos = ? WHERE note_tree_id = ?", [entity.ordering[key], key]);
        });

        await sync_table.addNoteReorderingSync(db, entity.note_pid, sourceId);
    });
}

async function updateOptions(entity, sourceId) {
    if (!options.SYNCED_OPTIONS.includes(entity.opt_name)) {
        return;
    }

    const orig = await sql.getSingleResultOrNull("SELECT * FROM options WHERE opt_name = ?", [entity.opt_name]);

    await sql.doInTransaction(async db => {
        if (orig === null || orig.date_modified < entity.date_modified) {
            await sql.replace(db, 'options', entity);

            await sync_table.addOptionsSync(db, entity.opt_name, sourceId);

            await eventLog.addEvent(db, "Synced option " + entity.opt_name);
        }
        else {
            await eventLog.addEvent(db, "Sync conflict in options for " + entity.opt_name + ", " + utils.formatTwoTimestamps(orig.date_modified, entity.date_modified));
        }
    });
}

async function updateRecentNotes(entity, sourceId) {
    const orig = await sql.getSingleResultOrNull("SELECT * FROM recent_notes WHERE note_path = ?", [entity.note_path]);

    if (orig === null || orig.date_accessed < entity.date_accessed) {
        await sql.doInTransaction(async db => {
            await sql.replace(db, 'recent_notes', entity);

            await sync_table.addRecentNoteSync(db, entity.note_path, sourceId);
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