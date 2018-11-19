"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const log = require('./log');
const messagingService = require('./messaging');
const syncMutexService = require('./sync_mutex');
const repository = require('./repository.js');
const cls = require('./cls');

async function runCheck(query, errorText, errorList) {
    const result = await sql.getColumn(query);

    if (result.length > 0) {
        const resultText = result.map(val => "'" + val + "'").join(', ');

        const err = errorText + ": " + resultText;
        errorList.push(err);

        log.error(err);
    }
}

async function checkTreeCycles(errorList) {
    const childToParents = {};
    const rows = await sql.getRows("SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0");

    for (const row of rows) {
        const childNoteId = row.noteId;
        const parentNoteId = row.parentNoteId;

        childToParents[childNoteId] = childToParents[childNoteId] || [];
        childToParents[childNoteId].push(parentNoteId);
    }

    function checkTreeCycle(noteId, path, errorList) {
        if (noteId === 'root') {
            return;
        }

        if (!childToParents[noteId] || childToParents[noteId].length === 0) {
            errorList.push(`No parents found for noteId=${noteId}`);
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

    if (childToParents['root'].length !== 1 || childToParents['root'][0] !== 'none') {
        errorList.push('Incorrect root parent: ' + JSON.stringify(childToParents['root']));
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
          sync.id IS NULL AND ` + (table === 'options' ? 'isSynced = 1' : '1'),
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

async function fixEmptyRelationTargets(errorList) {
    const emptyRelations = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'relation' AND value = ''");

    for (const relation of emptyRelations) {
        relation.isDeleted = true;
        await relation.save();

        errorList.push(`Relation ${relation.attributeId} of name "${relation.name} has empty target. Autofixed.`);
    }
}

async function runAllChecks() {
    const errorList = [];

    await runCheck(`
          SELECT 
            noteId 
          FROM 
            notes 
            LEFT JOIN branches USING(noteId) 
          WHERE 
            noteId != 'root' 
            AND branches.branchId IS NULL`,
        "Missing branches records for following note IDs", errorList);

    await runCheck(`
          SELECT 
            branchId || ' > ' || branches.noteId 
          FROM 
            branches 
            LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following branch ID > note ID", errorList);

    await runCheck(`
          SELECT 
            branchId 
          FROM 
            branches 
            JOIN notes USING(noteId) 
          WHERE 
            notes.isDeleted = 1 
            AND branches.isDeleted = 0`,
        "Branch is not deleted even though main note is deleted for following branch IDs", errorList);

    await runCheck(`
          SELECT 
            child.branchId
          FROM 
            branches AS child
          WHERE 
            child.isDeleted = 0
            AND child.parentNoteId != 'none'
            AND (SELECT COUNT(*) FROM branches AS parent WHERE parent.noteId = child.parentNoteId 
                                                                 AND parent.isDeleted = 0) = 0`,
        "All parent branches are deleted but child branch is not for these child branch IDs", errorList);

    // we do extra JOIN to eliminate orphan notes without branches (which are reported separately)
    await runCheck(`
          SELECT
            DISTINCT noteId
          FROM
            notes
            JOIN branches USING(noteId)
          WHERE
            (SELECT COUNT(*) FROM branches WHERE notes.noteId = branches.noteId AND branches.isDeleted = 0) = 0
            AND notes.isDeleted = 0
    `, 'No undeleted branches for note IDs', errorList);

    await runCheck(`
          SELECT 
            child.parentNoteId || ' > ' || child.noteId 
          FROM branches 
            AS child 
            LEFT JOIN branches AS parent ON parent.noteId = child.parentNoteId 
          WHERE 
            parent.noteId IS NULL 
            AND child.parentNoteId != 'none'`,
        "Not existing parent in the following parent > child relations", errorList);

    await runCheck(`
          SELECT 
            noteRevisionId || ' > ' || note_revisions.noteId 
          FROM 
            note_revisions LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note revision ID > note ID", errorList);

    await runCheck(`
          SELECT 
            branches.parentNoteId || ' > ' || branches.noteId 
          FROM 
            branches 
          WHERE 
            branches.isDeleted = 0
          GROUP BY 
            branches.parentNoteId,
            branches.noteId
          HAVING 
            COUNT(*) > 1`,
        "Duplicate undeleted parent note <-> note relationship - parent note ID > note ID", errorList);

    await runCheck(`
          SELECT 
            noteId
          FROM 
            notes
          WHERE 
            type != 'text' 
            AND type != 'code' 
            AND type != 'render' 
            AND type != 'file' 
            AND type != 'image' 
            AND type != 'search' 
            AND type != 'relation-map'`,
        "Note has invalid type", errorList);

    await runCheck(`
          SELECT
            noteId
          FROM
            notes
          WHERE
            isDeleted = 0
            AND content IS NULL`,
        "Note content is null even though it is not deleted", errorList);

    await runCheck(`
          SELECT 
            parentNoteId
          FROM 
            branches
            JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE 
            type == 'search'`,
        "Search note has children", errorList);

    await fixEmptyRelationTargets(errorList);

    await runCheck(`
          SELECT 
            attributeId
          FROM 
            attributes
          WHERE 
            type != 'label' 
            AND type != 'label-definition' 
            AND type != 'relation'
            AND type != 'relation-definition'`,
        "Attribute has invalid type", errorList);

    await runCheck(`
          SELECT 
            attributeId
          FROM 
            attributes
            LEFT JOIN notes ON attributes.noteId = notes.noteId AND notes.isDeleted = 0
          WHERE
            attributes.isDeleted = 0
            AND notes.noteId IS NULL`,
        "Attribute reference to the owning note is broken", errorList);

    await runCheck(`
          SELECT
            attributeId
          FROM
            attributes
            LEFT JOIN notes AS targetNote ON attributes.value = targetNote.noteId AND targetNote.isDeleted = 0
          WHERE
            attributes.type = 'relation'
            AND attributes.isDeleted = 0
            AND targetNote.noteId IS NULL`,
        "Relation reference to the target note is broken", errorList);

    await runCheck(`
          SELECT 
            linkId
          FROM 
            links
          WHERE 
            type != 'image'
            AND type != 'hyper'
            AND type != 'relation-map'`,
        "Link type is invalid", errorList);

    await runCheck(`
          SELECT 
            linkId
          FROM 
            links
            LEFT JOIN notes AS sourceNote ON sourceNote.noteId = links.noteId AND sourceNote.isDeleted = 0
            LEFT JOIN notes AS targetNote ON targetNote.noteId = links.noteId AND targetNote.isDeleted = 0
          WHERE 
            links.isDeleted = 0
            AND (sourceNote.noteId IS NULL
                 OR targetNote.noteId IS NULL)`,
        "Link to source/target note link is broken", errorList);

    await runSyncRowChecks("notes", "noteId", errorList);
    await runSyncRowChecks("note_revisions", "noteRevisionId", errorList);
    await runSyncRowChecks("branches", "branchId", errorList);
    await runSyncRowChecks("recent_notes", "branchId", errorList);
    await runSyncRowChecks("attributes", "attributeId", errorList);
    await runSyncRowChecks("api_tokens", "apiTokenId", errorList);
    await runSyncRowChecks("options", "name", errorList);

    if (errorList.length === 0) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles(errorList);
    }

    return errorList;
}

async function runChecks() {
    let errorList;
    let elapsedTimeMs;

    await syncMutexService.doExclusively(async () => {
        const startTime = new Date();

        errorList = await runAllChecks();

        elapsedTimeMs = new Date().getTime() - startTime.getTime();
    });

    if (errorList.length > 0) {
        log.info(`Consistency checks failed (took ${elapsedTimeMs}ms) with these errors: ` + JSON.stringify(errorList));

        messagingService.sendMessageToAllClients({type: 'consistency-checks-failed'});
    }
    else {
        log.info(`All consistency checks passed (took ${elapsedTimeMs}ms)`);
    }
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(runChecks), 60 * 60 * 1000);

    // kickoff backup immediately
    setTimeout(cls.wrap(runChecks), 10000);
});

module.exports = {
    runChecks
};