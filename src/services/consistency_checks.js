"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const log = require('./log');
const messagingService = require('./messaging');
const syncMutexService = require('./sync_mutex');
const repository = require('./repository');
const cls = require('./cls');
const Branch = require('../entities/branch');

let outstandingConsistencyErrors = false;

async function runCheck(recoverable, query, errorText) {
    const results = await sql.getRows(query);

    if (results.length > 0) {
        const resultText = results.map(row => "'" + row.value + "'").join(', ');

        log.error(errorText + ": " + resultText);

        if (!recoverable) {
            outstandingConsistencyErrors = true;
        }
    }

    return results;
}

async function checkTreeCycles() {
    const childToParents = {};
    const rows = await sql.getRows("SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0");

    for (const row of rows) {
        const childNoteId = row.noteId;
        const parentNoteId = row.parentNoteId;

        childToParents[childNoteId] = childToParents[childNoteId] || [];
        childToParents[childNoteId].push(parentNoteId);
    }

    function checkTreeCycle(noteId, path) {
        if (noteId === 'root') {
            return;
        }

        if (!childToParents[noteId] || childToParents[noteId].length === 0) {
            errorList.push(`No parents found for noteId=${noteId}`);
            return;
        }

        for (const parentNoteId of childToParents[noteId]) {
            if (path.includes(parentNoteId)) {
                log.error(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);
                
                outstandingConsistencyErrors = true;
            }
            else {
                const newPath = path.slice();
                newPath.push(noteId);

                checkTreeCycle(parentNoteId, newPath);
            }
        }
    }

    const noteIds = Object.keys(childToParents);

    for (const noteId of noteIds) {
        checkTreeCycle(noteId, []);
    }

    if (childToParents['root'].length !== 1 || childToParents['root'][0] !== 'none') {
        log.error('Incorrect root parent: ' + JSON.stringify(childToParents['root']));
        outstandingConsistencyErrors = true;
    }
}

async function runSyncRowChecks(table, key) {
    await runCheck(false, `
        SELECT 
          ${key} AS value
        FROM 
          ${table} 
          LEFT JOIN sync ON sync.entityName = '${table}' AND entityId = ${key} 
        WHERE 
          sync.id IS NULL AND ` + (table === 'options' ? 'isSynced = 1' : '1'),
        `Missing sync records for ${key} in table ${table}`);

    await runCheck(false, `
        SELECT 
          entityId AS value
        FROM 
          sync 
          LEFT JOIN ${table} ON entityId = ${key} 
        WHERE 
          sync.entityName = '${table}' 
          AND ${key} IS NULL`,
        `Missing ${table} records for existing sync rows`);
}

async function fixEmptyRelationTargets() {
    const emptyRelations = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'relation' AND value = ''");

    for (const relation of emptyRelations) {
        relation.isDeleted = true;
        await relation.save();

        log.error(`Relation ${relation.attributeId} of name "${relation.name} has empty target. Autofixed.`);
    }
}

async function checkMissingBranches() {
    const notes = await runCheck(true, `
          SELECT 
            noteId AS value
          FROM 
            notes 
            LEFT JOIN branches USING(noteId) 
          WHERE 
            noteId != 'root' 
            AND branches.branchId IS NULL`,
        "Missing branches for following note IDs");

    for (const {value: noteId} of notes) {
        const branch = await new Branch({
            parentNoteId: 'root',
            noteId: noteId,
            prefix: 'recovered'
        }).save();

        log.info(`Created missing branch ${branch.branchId} for note ${noteId}`);
    }
}

async function checkMissingNotes() {
    const records = await runCheck(true, `
          SELECT 
            branchId || ' > ' || branches.noteId AS value, branchId, branches.noteId
          FROM 
            branches 
            LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following branch ID > note ID");

    for (const {branchId, noteId} of records) {
        const branch = await repository.getBranch(branchId);
        branch.isDeleted = true;
        await branch.save();

        log.info(`Removed ${branchId} because it pointed to the missing ${noteId}`);
    }
}

async function checkAllDeletedNotesBranchesAreDeleted() {
    const branches = await runCheck(true, `
          SELECT 
            branchId AS value, branchId, noteId
          FROM 
            branches 
            JOIN notes USING(noteId) 
          WHERE 
            notes.isDeleted = 1 
            AND branches.isDeleted = 0`,
        "Branch is not deleted even though main note is deleted for following branch IDs");

    for (const {branchId, noteId} of branches) {
        const branch = await repository.getBranch(branchId);
        branch.isDeleted = true;
        await branch.save();

        log.info(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
    }
}

async function checkAllNotesShouldHaveUndeletedBranch() {
    // we do extra JOIN to eliminate orphan notes without branches (which are reported separately)
    const notes = await runCheck(true, `
          SELECT
            DISTINCT noteId AS value
          FROM
            notes
            JOIN branches USING(noteId)
          WHERE
            (SELECT COUNT(*) FROM branches WHERE notes.noteId = branches.noteId AND branches.isDeleted = 0) = 0
            AND notes.isDeleted = 0
    `, 'No undeleted branches for note IDs');

    for (const {value: noteId} of notes) {
        const branch = await new Branch({
            parentNoteId: 'root',
            noteId: noteId,
            prefix: 'recovered'
        }).save();

        log.info(`Created missing branch ${branch.branchId} for note ${noteId}`);
    }
}

async function runAllChecks() {
    outstandingConsistencyErrors = false;

    await checkMissingBranches();

    await checkMissingNotes();

    await checkAllDeletedNotesBranchesAreDeleted();

    // FIXME - does this make sense? Specifically branch - branch comparison seems strange
    await runCheck(false, `
          SELECT 
            child.branchId AS value
          FROM 
            branches AS child
          WHERE 
            child.isDeleted = 0
            AND child.parentNoteId != 'none'
            AND (SELECT COUNT(*) FROM branches AS parent WHERE parent.noteId = child.parentNoteId 
                                                                 AND parent.isDeleted = 0) = 0`,
        "All parent branches are deleted but child branch is not for these child branch IDs");

    await checkAllNotesShouldHaveUndeletedBranch();

    await runCheck(false, `
          SELECT 
            child.parentNoteId || ' > ' || child.noteId AS value
          FROM branches 
            AS child 
            LEFT JOIN branches AS parent ON parent.noteId = child.parentNoteId 
          WHERE 
            parent.noteId IS NULL 
            AND child.parentNoteId != 'none'`,
        "Not existing parent in the following parent > child relations");

    await runCheck(false, `
          SELECT 
            noteRevisionId || ' > ' || note_revisions.noteId AS value
          FROM 
            note_revisions LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        "Missing notes records for following note revision ID > note ID");

    await runCheck(false, `
          SELECT 
            branches.parentNoteId || ' > ' || branches.noteId AS value
          FROM 
            branches 
          WHERE 
            branches.isDeleted = 0
          GROUP BY 
            branches.parentNoteId,
            branches.noteId
          HAVING 
            COUNT(*) > 1`,
        "Duplicate undeleted parent note <-> note relationship - parent note ID > note ID");

    await runCheck(false, `
          SELECT 
            noteId AS value
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
        "Note has invalid type");

    await runCheck(false, `
          SELECT
            noteId AS value
          FROM
            notes
          WHERE
            isDeleted = 0
            AND content IS NULL`,
        "Note content is null even though it is not deleted");

    await runCheck(false, `
          SELECT 
            parentNoteId AS value
          FROM 
            branches
            JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE 
            type == 'search'`,
        "Search note has children");

    await fixEmptyRelationTargets();

    await runCheck(false, `
          SELECT 
            attributeId AS value
          FROM 
            attributes
          WHERE 
            type != 'label' 
            AND type != 'label-definition' 
            AND type != 'relation'
            AND type != 'relation-definition'`,
        "Attribute has invalid type");

    await runCheck(false,`
          SELECT 
            attributeId AS value
          FROM 
            attributes
            LEFT JOIN notes ON attributes.noteId = notes.noteId AND notes.isDeleted = 0
          WHERE
            attributes.isDeleted = 0
            AND notes.noteId IS NULL`,
        "Attribute reference to the owning note is broken");

    await runCheck(false, `
          SELECT
            attributeId AS value
          FROM
            attributes
            LEFT JOIN notes AS targetNote ON attributes.value = targetNote.noteId AND targetNote.isDeleted = 0
          WHERE
            attributes.type = 'relation'
            AND attributes.isDeleted = 0
            AND targetNote.noteId IS NULL`,
        "Relation reference to the target note is broken");

    await runCheck(false, `
          SELECT 
            linkId AS value
          FROM 
            links
          WHERE 
            type != 'image'
            AND type != 'hyper'
            AND type != 'relation-map'`,
        "Link type is invalid");

    await runCheck(false, `
          SELECT 
            linkId AS value
          FROM 
            links
            LEFT JOIN notes AS sourceNote ON sourceNote.noteId = links.noteId AND sourceNote.isDeleted = 0
            LEFT JOIN notes AS targetNote ON targetNote.noteId = links.noteId AND targetNote.isDeleted = 0
          WHERE 
            links.isDeleted = 0
            AND (sourceNote.noteId IS NULL
                 OR targetNote.noteId IS NULL)`,
        "Link to source/target note link is broken");

    await runSyncRowChecks("notes", "noteId");
    await runSyncRowChecks("note_revisions", "noteRevisionId");
    await runSyncRowChecks("branches", "branchId");
    await runSyncRowChecks("recent_notes", "branchId");
    await runSyncRowChecks("attributes", "attributeId");
    await runSyncRowChecks("api_tokens", "apiTokenId");
    await runSyncRowChecks("options", "name");

    if (outstandingConsistencyErrors) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles();
    }

    return !outstandingConsistencyErrors;
}

async function runChecks() {
    let elapsedTimeMs;
    let dbConsistent;

    await syncMutexService.doExclusively(async () => {
        const startTime = new Date();

        dbConsistent = await runAllChecks();

        elapsedTimeMs = new Date().getTime() - startTime.getTime();
    });

    if (!dbConsistent) {
        log.info(`Consistency checks failed (took ${elapsedTimeMs}ms)`);

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