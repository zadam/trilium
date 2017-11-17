const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addNoteTreeSync(noteId, sourceId) {
    await addEntitySync("notes_tree", noteId, sourceId)
}

async function addNoteReorderingSync(noteId, sourceId) {
    await addEntitySync("notes_reordering", noteId, sourceId)
}

async function addNoteHistorySync(noteHistoryId, sourceId) {
    await addEntitySync("notes_history", noteHistoryId, sourceId);
}

async function addOptionsSync(optName, sourceId) {
    await addEntitySync("options", optName, sourceId);
}

async function addRecentNoteSync(noteId, sourceId) {
    await addEntitySync("recent_notes", noteId, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await sql.replace("sync", {
        entity_name: entityName,
        entity_id: entityId,
        sync_date: utils.nowTimestamp(),
        source_id: sourceId || source_id.currentSourceId
    });
}

module.exports = {
    addNoteSync,
    addNoteTreeSync,
    addNoteReorderingSync,
    addNoteHistorySync,
    addOptionsSync,
    addRecentNoteSync
};