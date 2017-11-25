const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');
const messaging = require('./messaging');

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
        sync_date: utils.nowTimestamp(),
        source_id: sourceId || source_id.currentSourceId
    });
}

let startTime = utils.nowTimestamp();
let sentSyncId = [];

setInterval(async () => {
    const syncs = await sql.getResults("SELECT * FROM sync WHERE sync_date >= ?", [startTime]);
    startTime = utils.nowTimestamp();

    const data = {};
    const syncIds = [];

    for (const sync of syncs) {
        if (sentSyncId.includes(sync.id)) {
            continue;
        }

        if (!data[sync.entity_name]) {
            data[sync.entity_name] = [];
        }

        data[sync.entity_name].push(sync.entity_id);
        syncIds.push(sync.id);
    }

    if (syncIds.length > 0) {
        messaging.send({
            type: 'sync',
            data: data
        });

        for (const syncId of syncIds) {
            sentSyncId.push(syncId);
        }
    }
}, 1000);

module.exports = {
    addNoteSync,
    addNoteTreeSync,
    addNoteReorderingSync,
    addNoteHistorySync,
    addOptionsSync,
    addRecentNoteSync
};