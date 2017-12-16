const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');
const sync_setup = require('./sync_setup');

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addNoteTreeSync(noteTreeId, sourceId) {
    await addEntitySync("notes_tree", noteTreeId, sourceId)
}

async function addNoteReorderingSync(parentNoteTreeId, sourceId) {
    await addEntitySync("notes_reordering", parentNoteTreeId, sourceId)
}

async function addNoteHistorySync(noteHistoryId, sourceId) {
    await addEntitySync("notes_history", noteHistoryId, sourceId);
}

async function addOptionsSync(optName, sourceId) {
    await addEntitySync("options", optName, sourceId);
}

async function addRecentNoteSync(notePath, sourceId) {
    await addEntitySync("recent_notes", notePath, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entity_name: entityName,
        entity_id: entityId,
        sync_date: utils.nowDate(),
        source_id: sourceId || source_id.currentSourceId
    });

    if (!sync_setup.isSyncSetup) {
        // this is because the "server" instances shouldn't have outstanding pushes
        // useful when you fork the DB for new "client" instance, it won't try to sync the whole DB
        await sql.execute("UPDATE options SET opt_value = (SELECT MAX(id) FROM sync) WHERE opt_name IN('last_synced_push', 'last_synced_pull')");
    }
}

module.exports = {
    addNoteSync,
    addNoteTreeSync,
    addNoteReorderingSync,
    addNoteHistorySync,
    addOptionsSync,
    addRecentNoteSync
};