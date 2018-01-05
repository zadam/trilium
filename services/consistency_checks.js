"use strict";

const sql = require('./sql');
const log = require('./log');
const messaging = require('./messaging');
const sync_mutex = require('./sync_mutex');

async function runCheck(query, errorText, errorList) {
    const result = await sql.getFirstColumn(query);

    if (result.length > 0) {
        const resultText = result.map(val => "'" + val + "'").join(', ');

        const err = errorText + ": " + resultText;
        errorList.push(err);

        log.error(err);
    }
}

async function checkTreeCycles(errorList) {
    const childToParents = {};
    const rows = await sql.getAll("SELECT note_id, parent_note_id FROM notes_tree WHERE is_deleted = 0");

    for (const row of rows) {
        const childNoteId = row.note_id;
        const parentNoteId = row.parent_note_id;

        if (!childToParents[childNoteId]) {
            childToParents[childNoteId] = [];
        }

        childToParents[childNoteId].push(parentNoteId);
    }

    function checkTreeCycle(noteId, path, errorList) {
        if (noteId === 'root') {
            return;
        }

        for (const parentNoteId of childToParents[noteId]) {
            if (path.includes(parentNoteId)) {
                errorList.push(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);
            }
            else {
                const newPath = path.slice();
                newPath.push(noteId);

                checkTreeCycle(parentNoteId, newPath, errorList);
            }
        }
    }

    const noteIds = Object.keys(childToParents);

    for (const noteId of noteIds) {
        checkTreeCycle(noteId, [], errorList);
    }
}

async function runSyncRowChecks(table, key, errorList) {
    await runCheck(`
        SELECT 
          ${key} 
        FROM 
          ${table} 
          LEFT JOIN sync ON sync.entity_name = '${table}' AND entity_id = ${key} 
        WHERE 
          sync.id IS NULL`,
        `Missing sync records for ${key} in table ${table}`, errorList);

    await runCheck(`
        SELECT 
          entity_id 
        FROM 
          sync 
          LEFT JOIN ${table} ON entity_id = ${key} 
        WHERE 
          sync.entity_name = '${table}' 
          AND ${key} IS NULL`,
        `Missing ${table} records for existing sync rows`, errorList);
}

async function runAllChecks() {
    const errorList = [];

    await runCheck(`
          SELECT 
            note_id 
          FROM 
            notes 
            LEFT JOIN notes_tree USING(note_id) 
          WHERE 
            note_id != 'root' 
            AND notes_tree.note_tree_id IS NULL`,
        "Missing notes_tree records for following note IDs", errorList);

    await runCheck(`
          SELECT 
            note_tree_id || ' > ' || notes_tree.note_id 
          FROM 
            notes_tree 
            LEFT JOIN notes USING(note_id) 
          WHERE 
            notes.note_id IS NULL`,
        "Missing notes records for following note tree ID > note ID", errorList);

    await runCheck(`
          SELECT 
            note_tree_id 
          FROM 
            notes_tree 
            JOIN notes USING(note_id) 
          WHERE 
            notes.is_deleted = 1 
            AND notes_tree.is_deleted = 0`,
        "Note tree is not deleted even though main note is deleted for following note tree IDs", errorList);

    await runCheck(`
          SELECT 
            child.note_id 
          FROM 
            notes_tree 
            JOIN notes AS child ON child.note_id = notes_tree.note_id 
            JOIN notes AS parent ON notes_tree.parent_note_id = parent.note_id 
          WHERE 
            parent.is_deleted = 1 
            AND child.is_deleted = 0`,
        "Parent note is deleted but child note is not for these child note IDs", errorList);

    // we do extra JOIN to eliminate orphan notes without note tree (which are reported separately)
    await runCheck(`
          SELECT
            DISTINCT note_id
          FROM
            notes
            JOIN notes_tree USING(note_id)
          WHERE
            (SELECT COUNT(*) FROM notes_tree WHERE notes.note_id = notes_tree.note_id AND notes_tree.is_deleted = 0) = 0
            AND notes.is_deleted = 0
    `,);

    await runCheck(`
          SELECT 
            child.parent_note_id || ' > ' || child.note_id 
          FROM notes_tree 
            AS child 
            LEFT JOIN notes_tree AS parent ON parent.note_id = child.parent_note_id 
          WHERE 
            parent.note_id IS NULL 
            AND child.parent_note_id != 'root'`,
        "Not existing parent in the following parent > child relations", errorList);

    await runCheck(`
          SELECT 
            note_history_id || ' > ' || notes_history.note_id 
          FROM 
            notes_history LEFT JOIN notes USING(note_id) 
          WHERE 
            notes.note_id IS NULL`,
        "Missing notes records for following note history ID > note ID", errorList);

    await runCheck(`
          SELECT 
            notes_tree.parent_note_id || ' > ' || notes_tree.note_id 
          FROM 
            notes_tree 
          WHERE 
            notes_tree.is_deleted = 0
          GROUP BY 
            notes_tree.parent_note_id,
            notes_tree.note_id
          HAVING 
            COUNT(*) > 1`,
        "Duplicate undeleted parent note <-> note relationship - parent note ID > note ID", errorList);

    await runSyncRowChecks("notes", "note_id", errorList);
    await runSyncRowChecks("notes_history", "note_history_id", errorList);
    await runSyncRowChecks("notes_tree", "note_tree_id", errorList);
    await runSyncRowChecks("recent_notes", "note_tree_id", errorList);

    if (errorList.length === 0) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles(errorList);
    }

    return errorList;
}

async function runChecks() {
    let errorList;
    let elapsedTimeMs;
    const releaseMutex = await sync_mutex.acquire();

    try {
        const startTime = new Date();

        errorList = await runAllChecks();

        elapsedTimeMs = new Date().getTime() - startTime.getTime();
    }
    finally {
        releaseMutex();
    }

    if (errorList.length > 0) {
        log.info(`Consistency checks failed (took ${elapsedTimeMs}ms) with these errors: ` + JSON.stringify(errorList));

        messaging.sendMessageToAllClients({type: 'consistency-checks-failed'});
    }
    else {
        log.info(`All consistency checks passed (took ${elapsedTimeMs}ms)`);
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