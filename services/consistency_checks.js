"use strict";

const sql = require('./sql');
const log = require('./log');
const messaging = require('./messaging');
const sync_mutex = require('./sync_mutex');
const utils = require('./utils');

async function runCheck(query, errorText, errorList) {
    utils.assertArguments(query, errorText, errorList);

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
    const rows = await sql.getAll("SELECT noteId, parentNoteId FROM notes_tree WHERE isDeleted = 0");

    for (const row of rows) {
        const childNoteId = row.noteId;
        const parentNoteId = row.parentNoteId;

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
          LEFT JOIN sync ON sync.entityName = '${table}' AND entityId = ${key} 
        WHERE 
          sync.id IS NULL`,
        `Missing sync records for ${key} in table ${table}`, errorList);

    await runCheck(`
        SELECT 
          entityId 
        FROM 
          sync 
          LEFT JOIN ${table} ON entityId = ${key} 
        WHERE 
          sync.entityName = '${table}' 
          AND ${key} IS NULL`,
        `Missing ${table} records for existing sync rows`, errorList);
}

async function runAllChecks() {
    const errorList = [];

    await runCheck(`
          SELECT 
            noteId 
          FROM 
            notes 
            LEFT JOIN notes_tree USING(noteId) 
          WHERE 
            noteId != 'root' 
            AND notes_tree.noteTreeId IS NULL`,
        "Missing notes_tree records for following note IDs", errorList);

    await runCheck(`
          SELECT 
            noteTreeId || ' > ' || notes_tree.noteId 
          FROM 
            notes_tree 
            LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note tree ID > note ID", errorList);

    await runCheck(`
          SELECT 
            noteTreeId 
          FROM 
            notes_tree 
            JOIN notes USING(noteId) 
          WHERE 
            notes.isDeleted = 1 
            AND notes_tree.isDeleted = 0`,
        "Note tree is not deleted even though main note is deleted for following note tree IDs", errorList);

    await runCheck(`
          SELECT 
            child.noteTreeId
          FROM 
            notes_tree AS child
          WHERE 
            child.isDeleted = 0
            AND child.parentNoteId != 'root'
            AND (SELECT COUNT(*) FROM notes_tree AS parent WHERE parent.noteId = child.parentNoteId 
                                                                 AND parent.isDeleted = 0) = 0`,
        "All parent note trees are deleted but child note tree is not for these child note tree IDs", errorList);

    // we do extra JOIN to eliminate orphan notes without note tree (which are reported separately)
    await runCheck(`
          SELECT
            DISTINCT noteId
          FROM
            notes
            JOIN notes_tree USING(noteId)
          WHERE
            (SELECT COUNT(*) FROM notes_tree WHERE notes.noteId = notes_tree.noteId AND notes_tree.isDeleted = 0) = 0
            AND notes.isDeleted = 0
    `, 'No undeleted note trees for note IDs', errorList);

    await runCheck(`
          SELECT 
            child.parentNoteId || ' > ' || child.noteId 
          FROM notes_tree 
            AS child 
            LEFT JOIN notes_tree AS parent ON parent.noteId = child.parentNoteId 
          WHERE 
            parent.noteId IS NULL 
            AND child.parentNoteId != 'root'`,
        "Not existing parent in the following parent > child relations", errorList);

    await runCheck(`
          SELECT 
            noteHistoryId || ' > ' || notes_history.noteId 
          FROM 
            notes_history LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note history ID > note ID", errorList);

    await runCheck(`
          SELECT 
            notes_tree.parentNoteId || ' > ' || notes_tree.noteId 
          FROM 
            notes_tree 
          WHERE 
            notes_tree.isDeleted = 0
          GROUP BY 
            notes_tree.parentNoteId,
            notes_tree.noteId
          HAVING 
            COUNT(*) > 1`,
        "Duplicate undeleted parent note <-> note relationship - parent note ID > note ID", errorList);

    await runCheck(`
          SELECT 
            images.imageId
          FROM 
            images
            LEFT JOIN notes_image ON notes_image.imageId = images.imageId
          WHERE 
            notes_image.noteImageId IS NULL`,
        "Image with no note relation", errorList);

    await runCheck(`
          SELECT 
            notes_image.noteImageId
          FROM 
            notes_image
            JOIN images USING(imageId)
          WHERE 
            notes_image.isDeleted = 0
            AND images.isDeleted = 1`,
        "Note image is not deleted while image is deleted for noteImageId", errorList);

    await runCheck(`
          SELECT 
            noteId
          FROM 
            notes
          WHERE 
            isDeleted = 0
            AND (title IS NULL OR content IS NULL)`,
        "Note has null title or text", errorList);

    await runCheck(`
          SELECT 
            noteId
          FROM 
            notes
          WHERE 
            type != 'text' AND type != 'code' AND type != 'render'`,
        "Note has invalid type", errorList);

    await runSyncRowChecks("notes", "noteId", errorList);
    await runSyncRowChecks("notes_history", "noteHistoryId", errorList);
    await runSyncRowChecks("notes_tree", "noteTreeId", errorList);
    await runSyncRowChecks("recent_notes", "noteTreeId", errorList);
    await runSyncRowChecks("images", "imageId", errorList);
    await runSyncRowChecks("notes_image", "noteImageId", errorList);

    if (errorList.length === 0) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles(errorList);
    }

    return errorList;
}

async function runChecks() {
    let errorList;
    let elapsedTimeMs;

    await sync_mutex.doExclusively(async () => {
        const startTime = new Date();

        errorList = await runAllChecks();

        elapsedTimeMs = new Date().getTime() - startTime.getTime();
    });

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