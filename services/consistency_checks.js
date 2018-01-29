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
    const rows = await sql.getAll("SELECT noteId, parentNoteId FROM note_tree WHERE isDeleted = 0");

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
            LEFT JOIN note_tree USING(noteId) 
          WHERE 
            noteId != 'root' 
            AND note_tree.noteTreeId IS NULL`,
        "Missing note_tree records for following note IDs", errorList);

    await runCheck(`
          SELECT 
            noteTreeId || ' > ' || note_tree.noteId 
          FROM 
            note_tree 
            LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note tree ID > note ID", errorList);

    await runCheck(`
          SELECT 
            noteTreeId 
          FROM 
            note_tree 
            JOIN notes USING(noteId) 
          WHERE 
            notes.isDeleted = 1 
            AND note_tree.isDeleted = 0`,
        "Note tree is not deleted even though main note is deleted for following note tree IDs", errorList);

    await runCheck(`
          SELECT 
            child.noteTreeId
          FROM 
            note_tree AS child
          WHERE 
            child.isDeleted = 0
            AND child.parentNoteId != 'root'
            AND (SELECT COUNT(*) FROM note_tree AS parent WHERE parent.noteId = child.parentNoteId 
                                                                 AND parent.isDeleted = 0) = 0`,
        "All parent note trees are deleted but child note tree is not for these child note tree IDs", errorList);

    // we do extra JOIN to eliminate orphan notes without note tree (which are reported separately)
    await runCheck(`
          SELECT
            DISTINCT noteId
          FROM
            notes
            JOIN note_tree USING(noteId)
          WHERE
            (SELECT COUNT(*) FROM note_tree WHERE notes.noteId = note_tree.noteId AND note_tree.isDeleted = 0) = 0
            AND notes.isDeleted = 0
    `, 'No undeleted note trees for note IDs', errorList);

    await runCheck(`
          SELECT 
            child.parentNoteId || ' > ' || child.noteId 
          FROM note_tree 
            AS child 
            LEFT JOIN note_tree AS parent ON parent.noteId = child.parentNoteId 
          WHERE 
            parent.noteId IS NULL 
            AND child.parentNoteId != 'root'`,
        "Not existing parent in the following parent > child relations", errorList);

    await runCheck(`
          SELECT 
            noteRevisionId || ' > ' || note_revisions.noteId 
          FROM 
            note_revisions LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note history ID > note ID", errorList);

    await runCheck(`
          SELECT 
            note_tree.parentNoteId || ' > ' || note_tree.noteId 
          FROM 
            note_tree 
          WHERE 
            note_tree.isDeleted = 0
          GROUP BY 
            note_tree.parentNoteId,
            note_tree.noteId
          HAVING 
            COUNT(*) > 1`,
        "Duplicate undeleted parent note <-> note relationship - parent note ID > note ID", errorList);

    await runCheck(`
          SELECT 
            images.imageId
          FROM 
            images
            LEFT JOIN note_images ON note_images.imageId = images.imageId
          WHERE 
            note_images.noteImageId IS NULL`,
        "Image with no note relation", errorList);

    await runCheck(`
          SELECT 
            note_images.noteImageId
          FROM 
            note_images
            JOIN images USING(imageId)
          WHERE 
            note_images.isDeleted = 0
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
    await runSyncRowChecks("note_revisions", "noteRevisionId", errorList);
    await runSyncRowChecks("note_tree", "noteTreeId", errorList);
    await runSyncRowChecks("recent_notes", "noteTreeId", errorList);
    await runSyncRowChecks("images", "imageId", errorList);
    await runSyncRowChecks("note_images", "noteImageId", errorList);

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