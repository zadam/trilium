const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');

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
}

module.exports = {
    addNoteSync,
    addNoteTreeSync,
    addNoteReorderingSync,
    addNoteHistorySync,
    addOptionsSync,
    addRecentNoteSync
};