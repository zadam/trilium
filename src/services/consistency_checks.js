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

let outstandingConsistencyErrors = false;

async function findIssues(query, errorCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        log.error(errorCb(res));

        outstandingConsistencyErrors = true;
    }

    return results;
}

async function findAndFixIssues(query, fixerCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        await fixerCb(res);
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
            log.error(`No parents found for noteId=${noteId}`);

            outstandingConsistencyErrors = true;
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

            log.info(`Created missing sync record entityName=${entityName}, entityId=${entityId}`);
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

        log.error(`Deleted extra sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
    });
}

async function fixEmptyRelationTargets() {
    const emptyRelations = await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND type = 'relation' AND value = ''");

    for (const relation of emptyRelations) {
        relation.isDeleted = true;
        await relation.save();

        log.info(`Removed relation ${relation.attributeId} of name "${relation.name} with empty target..`);
    }
}

async function runAllChecks() {
    outstandingConsistencyErrors = false;

    await findAndFixIssues(`
          SELECT
            noteId
          FROM
            notes
              LEFT JOIN branches USING(noteId)
          WHERE
            noteId != 'root'
            AND branches.branchId IS NULL`,
        async ({noteId}) => {
            const branch = await new Branch({
                parentNoteId: 'root',
                noteId: noteId,
                prefix: 'recovered'
            }).save();

            log.info(`Created missing branch id=${branch.branchId} for note id=${noteId}`);
        });

    await findAndFixIssues(`
          SELECT
            branchId,
            branches.noteId
          FROM
            branches
            LEFT JOIN notes USING(noteId)
          WHERE
            notes.noteId IS NULL`,
        async ({branchId, noteId}) => {
            const branch = await repository.getBranch(branchId);
            branch.isDeleted = true;
            await branch.save();

            log.info(`Removed ${branchId} because it pointed to the missing ${noteId}`);
        });

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

            log.info(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
        });

    // we do extra JOIN to eliminate orphan notes without branches (which are reported separately)
    await findAndFixIssues(`
      SELECT
        DISTINCT noteId
      FROM
        notes
          JOIN branches USING(noteId)
      WHERE
          (SELECT COUNT(*) FROM branches WHERE notes.noteId = branches.noteId AND branches.isDeleted = 0) = 0
        AND notes.isDeleted = 0
    `, async ({noteId}) => {
        const branch = await new Branch({
            parentNoteId: 'root',
            noteId: noteId,
            prefix: 'recovered'
        }).save();

        log.info(`Created missing branch ${branch.branchId} for note ${noteId}`);
    });

    await findIssues(`
          SELECT 
            note_revisions.noteId,
            noteRevisionId
          FROM 
            note_revisions LEFT JOIN notes USING(noteId) 
          WHERE 
            notes.noteId IS NULL`,
        ({noteId, noteRevisionId}) => `Missing note id=${noteId} for note revision id = ${noteRevisionId}`);

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

                log.info(`Removing branch id=${branch.branchId} since it's parent-child duplicate of branch id=${origBranch.branchId}`);
            }
        });

    await findIssues( `
          SELECT 
            noteId,
            type
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
        ({noteId, type}) => `Note id=${noteId} has invalid type=${type}`);

    await findIssues(`
          SELECT
            noteId
          FROM
            notes
          WHERE
            isDeleted = 0
            AND content IS NULL`,
        ({noteId}) => `Note id=${noteId} content is null even though it is not deleted`);

    await findIssues(`
          SELECT 
            parentNoteId
          FROM 
            branches
            JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE 
            type == 'search'`,
        ({parentNoteId}) => `Search note id=${parentNoteId} has children`);

    await fixEmptyRelationTargets();

    await findIssues(`
          SELECT 
            attributeId,
            type
          FROM 
            attributes
          WHERE 
            type != 'label' 
            AND type != 'label-definition' 
            AND type != 'relation'
            AND type != 'relation-definition'`,
        ({attributeId, type}) => `Attribute id=${attributeId}, type=${type} has invalid type`);

    await findIssues(`
          SELECT 
            attributeId,
            attributes.noteId 
          FROM 
            attributes
            LEFT JOIN notes ON attributes.noteId = notes.noteId AND notes.isDeleted = 0
          WHERE
            attributes.isDeleted = 0
            AND notes.noteId IS NULL`,
        ({attributeId, noteId}) => `Attribute id=${attributeId} reference to the owning note id=${noteId} is broken`);

    await findIssues(`
          SELECT
            attributeId,
            value as targetNoteId
          FROM
            attributes
            LEFT JOIN notes AS targetNote ON attributes.value = targetNote.noteId AND targetNote.isDeleted = 0
          WHERE
            attributes.type = 'relation'
            AND attributes.isDeleted = 0
            AND targetNote.noteId IS NULL`,
        ({attributeId, targetNoteId}) => `Relation id=${attributeId} reference to the target note id=${targetNoteId} is broken`);

    await findIssues(`
          SELECT 
            linkId
          FROM 
            links
          WHERE 
            type != 'image'
            AND type != 'hyper'
            AND type != 'relation-map'`,
        ({linkId, type}) => `Link id=${linkId} type=${type} is invalid`);

    await findIssues(`
          SELECT 
            linkId,
            links.targetNoteId
          FROM 
            links
            LEFT JOIN notes AS targetNote ON targetNote.noteId = links.targetNoteId AND targetNote.isDeleted = 0
          WHERE 
            links.isDeleted = 0
            AND targetNote.noteId IS NULL`,
        ({linkId, targetNoteId}) => `Link id=${linkId} to target note id=${targetNoteId} is broken`);

    await findIssues(`
          SELECT 
            linkId,
            links.noteId AS sourceNoteId
          FROM 
            links
            LEFT JOIN notes AS sourceNote ON sourceNote.noteId = links.noteId AND sourceNote.isDeleted = 0
          WHERE 
            links.isDeleted = 0
            AND sourceNote.noteId IS NULL`,
        ({linkId, sourceNoteId}) => `Link id=${linkId} to source note id=${sourceNoteId} is broken`);

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

module.exports = {};