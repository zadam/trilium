const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');

async function addNoteSync(db, noteId, sourceId) {
    await addEntitySync(db, "notes", noteId, sourceId)
}

async function addNoteTreeSync(db, noteTreeId, sourceId) {
    await addEntitySync(db, "notes_tree", noteTreeId, sourceId)
}

async function addNoteReorderingSync(db, parentNoteTreeId, sourceId) {
    await addEntitySync(db, "notes_reordering", parentNoteTreeId, sourceId)
}

async function addNoteHistorySync(db, noteHistoryId, sourceId) {
    await addEntitySync(db, "notes_history", noteHistoryId, sourceId);
}

async function addOptionsSync(db, optName, sourceId) {
    await addEntitySync(db, "options", optName, sourceId);
}

async function addRecentNoteSync(db, notePath, sourceId) {
    await addEntitySync(db, "recent_notes", notePath, sourceId);
}

async function addEntitySync(db, entityName, entityId, sourceId) {
    await sql.replace(db, "sync", {
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