"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const log = require('./log');
const messagingService = require('./messaging');
const syncMutexService = require('./sync_mutex');
const repository = require('./repository');
const cls = require('./cls');
const syncTableService = require('./sync_table');
const Branch = require('../entities/branch');

let unrecoverableConsistencyErrors = false;
let fixedIssues = false;

async function findIssues(query, errorCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        logError(errorCb(res));

        unrecoverableConsistencyErrors = true;
    }

    return results;
}

async function findAndFixIssues(query, fixerCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        await fixerCb(res);

        fixedIssues = true;
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
            logError(`No parents found for note ${noteId}`);

            unrecoverableConsistencyErrors = true;
            return;
        }

        for (const parentNoteId of childToParents[noteId]) {
            if (path.includes(parentNoteId)) {
                logError(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);

                unrecoverableConsistencyErrors = true;
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
        logError('Incorrect root parent: ' + JSON.stringify(childToParents['root']));
        unrecoverableConsistencyErrors = true;
    }
}

async function findBrokenReferenceIssues() {
    await findIssues(`
          SELECT branchId, branches.noteId
          FROM branches LEFT JOIN notes USING(noteId)
          WHERE branches.isDeleted = 0 AND notes.noteId IS NULL`,
        ({branchId, noteId}) => `Branch ${branchId} references missing note ${noteId}`);

    await findIssues(`
          SELECT branchId, branches.noteId AS parentNoteId
          FROM branches LEFT JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE branches.isDeleted = 0 AND branches.branchId != 'root' AND notes.noteId IS NULL`,
        ({branchId, noteId}) => `Branch ${branchId} references missing parent note ${noteId}`);

    await findIssues(`
          SELECT attributeId, attributes.noteId
          FROM attributes LEFT JOIN notes USING(noteId)
          WHERE attributes.isDeleted = 0 AND notes.noteId IS NULL`,
        ({attributeId, noteId}) => `Attribute ${attributeId} references missing source note ${noteId}`);

    // empty targetNoteId for relations is a special fixable case so not covered here
    await findIssues(`
          SELECT attributeId, attributes.value AS noteId
          FROM attributes LEFT JOIN notes ON notes.noteId = attributes.value
          WHERE attributes.isDeleted = 0 AND attributes.type = 'relation' 
            AND attributes.value != '' AND notes.noteId IS NULL`,
        ({attributeId, noteId}) => `Relation ${attributeId} references missing note ${noteId}`);

    await findIssues(`
          SELECT linkId, links.noteId
          FROM links LEFT JOIN notes USING(noteId)
          WHERE links.isDeleted = 0 AND notes.noteId IS NULL`,
        ({linkId, noteId}) => `Link ${linkId} references missing source note ${noteId}`);

    await findIssues(`
          SELECT linkId, links.noteId
          FROM links LEFT JOIN notes ON notes.noteId = links.targetNoteId
          WHERE links.isDeleted = 0 AND notes.noteId IS NULL`,
        ({linkId, noteId}) => `Link ${linkId} references missing target note ${noteId}`);

    await findIssues(`
          SELECT noteRevisionId, note_revisions.noteId
          FROM note_revisions LEFT JOIN notes USING(noteId)
          WHERE notes.noteId IS NULL`,
        ({noteRevisionId, noteId}) => `Note revision ${noteRevisionId} references missing note ${noteId}`);
}

async function findExistencyIssues() {
    // principle for fixing inconsistencies is that if the note itself is deleted (isDeleted=true) then all related entities should be also deleted (branches, links, attributes)
    // but if note is not deleted, then at least one branch should exist.

    // the order here is important - first we might need to delete inconsistent branches and after that
    // another check might create missing branch
    await findAndFixIssues(`
          SELECT
            branchId, noteId
          FROM
            branches
              JOIN notes USING(noteId)
          WHERE
            notes.isDeleted = 1
            AND branches.isDeleted = 0`,
        async ({branchId, noteId}) => {
            const branch = await repository.getBranch(branchId);
            branch.isDeleted = true;
            await branch.save();

            logFix(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
        });

    await findAndFixIssues(`
      SELECT
        branchId, parentNoteId
      FROM
        branches
        JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
      WHERE
        parentNote.isDeleted = 1
        AND branches.isDeleted = 0
    `, async ({branchId, parentNoteId}) => {
        const branch = await repository.getBranch(branchId);
        branch.isDeleted = true;
        await branch.save();

        logFix(`Branch ${branchId} has been deleted since associated parent note ${parentNoteId} is deleted.`);
    });

    await findAndFixIssues(`
      SELECT
        DISTINCT notes.noteId
      FROM
        notes
        LEFT JOIN branches ON notes.noteId = branches.noteId AND branches.isDeleted = 0
      WHERE
        notes.isDeleted = 0
        AND branches.branchId IS NULL
    `, async ({noteId}) => {
        const branch = await new Branch({
            parentNoteId: 'root',
            noteId: noteId,
            prefix: 'recovered'
        }).save();

        logFix(`Created missing branch ${branch.branchId} for note ${noteId}`);
    });

    // there should be a unique relationship between note and its parent
    await findAndFixIssues(`
      SELECT
        noteId, parentNoteId
      FROM
        branches
      WHERE
        branches.isDeleted = 0
      GROUP BY
        branches.parentNoteId,
        branches.noteId
      HAVING
        COUNT(*) > 1`,
    async ({noteId, parentNoteId}) => {
        const branches = await repository.getEntities(`SELECT * FROM branches WHERE noteId = ? and parentNoteId = ? and isDeleted = 1`, [noteId, parentNoteId]);

        // it's not necessarily "original" branch, it's just the only one which will survive
        const origBranch = branches.get(0);

        // delete all but the first branch
        for (const branch of branches.slice(1)) {
            branch.isDeleted = true;
            await branch.save();

            logFix(`Removing branch ${branch.branchId} since it's parent-child duplicate of branch ${origBranch.branchId}`);
        }
    });
}

async function findLogicIssues() {
    await findIssues( `
          SELECT noteId, type 
          FROM notes 
          WHERE
            isDeleted = 0    
            AND type NOT IN ('text', 'code', 'render', 'file', 'image', 'search', 'relation-map')`,
        ({noteId, type}) => `Note ${noteId} has invalid type=${type}`);

    await findIssues(`
          SELECT noteId
          FROM notes
          JOIN note_contents USING(noteId)
          WHERE
            isDeleted = 0
            AND content IS NULL`,
        ({noteId}) => `Note ${noteId} content is null even though it is not deleted`);

    await findIssues(`
          SELECT parentNoteId
          FROM 
            branches
            JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE
            notes.isDeleted = 0
            AND notes.type == 'search'
            AND branches.isDeleted = 0`,
        ({parentNoteId}) => `Search note ${parentNoteId} has children`);

    await findAndFixIssues(`
          SELECT attributeId 
          FROM attributes 
          WHERE 
            isDeleted = 0 
            AND type = 'relation' 
            AND value = ''`,
        async ({attributeId}) => {
            const relation = await repository.getAttribute(attributeId);
            relation.isDeleted = true;
            await relation.save();

            logFix(`Removed relation ${relation.attributeId} of name "${relation.name} with empty target.`);
        });

    await findIssues(`
          SELECT 
            attributeId,
            type
          FROM attributes
          WHERE 
            isDeleted = 0    
            AND type != 'label' 
            AND type != 'label-definition' 
            AND type != 'relation'
            AND type != 'relation-definition'`,
        ({attributeId, type}) => `Attribute ${attributeId} has invalid type '${type}'`);

    await findAndFixIssues(`
          SELECT
            attributeId,
            attributes.noteId
          FROM
            attributes
            JOIN notes ON attributes.noteId = notes.noteId
          WHERE
            attributes.isDeleted = 0
            AND notes.isDeleted = 1`,
        async ({attributeId, noteId}) => {
            const attribute = await repository.getAttribute(attributeId);
            attribute.isDeleted = true;
            await attribute.save();

            logFix(`Removed attribute ${attributeId} because owning note ${noteId} is also deleted.`);
        });

    await findAndFixIssues(`
          SELECT
            attributeId,
            attributes.value AS targetNoteId
          FROM
            attributes
            JOIN notes ON attributes.value = notes.noteId
          WHERE
            attributes.type = 'relation'
            AND attributes.isDeleted = 0
            AND notes.isDeleted = 1`,
        async ({attributeId, targetNoteId}) => {
            const attribute = await repository.getAttribute(attributeId);
            attribute.isDeleted = true;
            await attribute.save();

            logFix(`Removed attribute ${attributeId} because target note ${targetNoteId} is also deleted.`);
        });

    await findIssues(`
          SELECT linkId
          FROM links
          WHERE type NOT IN ('image', 'hyper', 'relation-map')`,
        ({linkId, type}) => `Link ${linkId} has invalid type '${type}'`);

    await findAndFixIssues(`
          SELECT
            linkId,
            links.noteId AS sourceNoteId
          FROM
            links
              JOIN notes AS sourceNote ON sourceNote.noteId = links.noteId
          WHERE
            links.isDeleted = 0
            AND sourceNote.isDeleted = 1`,
        async ({linkId, sourceNoteId}) => {
            const link = await repository.getLink(linkId);
            link.isDeleted = true;
            await link.save();

            logFix(`Removed link ${linkId} because source note ${sourceNoteId} is also deleted.`);
        });

    await findAndFixIssues(`
          SELECT 
            linkId,
            links.targetNoteId
          FROM 
            links
            JOIN notes AS targetNote ON targetNote.noteId = links.targetNoteId
          WHERE
            links.isDeleted = 0
            AND targetNote.isDeleted = 1`,
        async ({linkId, targetNoteId}) => {
            const link = await repository.getLink(linkId);
            link.isDeleted = true;
            await link.save();

            logFix(`Removed link ${linkId} because target note ${targetNoteId} is also deleted.`);
        });
}

async function runSyncRowChecks(entityName, key) {
    await findAndFixIssues(`
        SELECT 
          ${key} as entityId
        FROM 
          ${entityName} 
          LEFT JOIN sync ON sync.entityName = '${entityName}' AND entityId = ${key} 
        WHERE 
          sync.id IS NULL AND ` + (entityName === 'options' ? 'isSynced = 1' : '1'),
        async ({entityId}) => {
            await syncTableService.addEntitySync(entityName, entityId);

            logFix(`Created missing sync record entityName=${entityName}, entityId=${entityId}`);
        });

    await findAndFixIssues(`
        SELECT 
          id, entityId
        FROM 
          sync 
          LEFT JOIN ${entityName} ON entityId = ${key} 
        WHERE 
          sync.entityName = '${entityName}' 
          AND ${key} IS NULL`,
        async ({id, entityId}) => {

            await sql.execute("DELETE FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

            logFix(`Deleted extra sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
        });
}

async function findSyncRowsIssues() {
    await runSyncRowChecks("notes", "noteId");
    await runSyncRowChecks("note_contents", "noteId");
    await runSyncRowChecks("note_revisions", "noteRevisionId");
    await runSyncRowChecks("branches", "branchId");
    await runSyncRowChecks("recent_notes", "noteId");
    await runSyncRowChecks("attributes", "attributeId");
    await runSyncRowChecks("api_tokens", "apiTokenId");
    await runSyncRowChecks("options", "name");
}

async function runAllChecks() {
    unrecoverableConsistencyErrors = false;
    fixedIssues = false;

    await findBrokenReferenceIssues();

    await findExistencyIssues();

    await findLogicIssues();

    await findSyncRowsIssues();

    if (unrecoverableConsistencyErrors) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles();
    }

    return !unrecoverableConsistencyErrors;
}

async function runChecks() {
    let elapsedTimeMs;

    await syncMutexService.doExclusively(async () => {
        const startTime = new Date();

        await runAllChecks();

        elapsedTimeMs = Date.now() - startTime.getTime();
    });

    if (fixedIssues) {
        messagingService.refreshTree();
    }

    if (unrecoverableConsistencyErrors) {
        log.info(`Consistency checks failed (took ${elapsedTimeMs}ms)`);

        messagingService.sendMessageToAllClients({type: 'consistency-checks-failed'});
    }
    else {
        log.info(`All consistency checks passed (took ${elapsedTimeMs}ms)`);
    }
}

function logFix(message) {
    log.info("Consistency issue fixed: " + message);
}

function logError(message) {
    log.info("Consistency error: " + message);
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(runChecks), 60 * 60 * 1000);

    // kickoff checks soon after startup (to not block the initial load)
    setTimeout(cls.wrap(runChecks), 10 * 1000);
});

module.exports = {};