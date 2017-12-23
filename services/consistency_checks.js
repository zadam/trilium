"use strict";

const sql = require('./sql');
const log = require('./log');
const messaging = require('./messaging');

async function runCheck(query, errorText, errorList) {
    const result = await sql.getFirstColumn(query);

    if (result.length > 0) {
        const err = errorText + ": " + result;
        errorList.push(err);

        log.error(err);
    }
}

async function runSyncRowChecks(table, key, errorList) {
    await runCheck(`SELECT ${key} FROM ${table} LEFT JOIN sync ON sync.entity_name = '${table}' AND entity_id = ${key} WHERE sync.id IS NULL`,
        `Missing sync records for ${key} in table ${table}`, errorList);

    await runCheck(`SELECT entity_id FROM sync LEFT JOIN ${table} ON entity_id = ${key} WHERE sync.entity_name = '${table}' AND ${key} IS NULL`,
        `Missing ${table} records for existing sync rows`, errorList);
}

async function runChecks() {
    const errorList = [];

    await runCheck("SELECT note_id FROM notes LEFT JOIN notes_tree USING(note_id) WHERE note_id != 'root' AND notes_tree.note_tree_id IS NULL",
        "Missing notes_tree records for following note IDs", errorList);

    await runCheck("SELECT note_tree_id || ' > ' || notes_tree.note_id FROM notes_tree LEFT JOIN notes USING(note_id) WHERE notes.note_id IS NULL",
        "Missing notes records for following note tree ID > note ID", errorList);

    await runCheck("SELECT note_tree_id FROM notes_tree JOIN notes USING(note_id) WHERE notes.is_deleted = 1 AND notes_tree.is_deleted = 0",
        "Note tree is not deleted even though main note is deleted for following note tree IDs", errorList);

    await runCheck("SELECT child.parent_note_id || ' > ' || child.note_id FROM notes_tree AS child LEFT JOIN notes_tree AS parent ON parent.note_id = child.parent_note_id WHERE parent.note_id IS NULL AND child.parent_note_id != 'root'",
        "Not existing parent in the following parent > child relations", errorList);

    await runCheck("SELECT note_history_id || ' > ' || notes_history.note_id FROM notes_history LEFT JOIN notes USING(note_id) WHERE notes.note_id IS NULL",
        "Missing notes records for following note history ID > note ID", errorList);

    await runSyncRowChecks("notes", "note_id", errorList);
    await runSyncRowChecks("notes_history", "note_history_id", errorList);
    await runSyncRowChecks("notes_tree", "note_tree_id", errorList);
    await runSyncRowChecks("recent_notes", "note_tree_id", errorList);

    if (errorList.length > 0) {
        messaging.sendMessageToAllClients({type: 'consistency-checks-failed'});
    }
    else {
        log.info("All consistency checks passed.");
    }
}

sql.dbReady.then(() => {
    setInterval(runChecks, 60 * 60 * 1000);

    // kickoff backup immediately
    setTimeout(runChecks, 10000);
});

module.exports = {
    runChecks
};