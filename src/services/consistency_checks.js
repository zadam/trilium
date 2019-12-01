"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const log = require('./log');
const ws = require('./ws.js');
const syncMutexService = require('./sync_mutex');
const repository = require('./repository');
const cls = require('./cls');
const syncTableService = require('./sync_table');
const optionsService = require('./options');
const Branch = require('../entities/branch');

let unrecoveredConsistencyErrors = false;
let fixedIssues = false;

async function findIssues(query, errorCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        logError(errorCb(res));

        unrecoveredConsistencyErrors = true;
    }

    return results;
}

async function findAndFixIssues(query, fixerCb) {
    const results = await sql.getRows(query);

    for (const res of results) {
        const autoFix = await optionsService.getOptionBool('autoFixConsistencyIssues');

        try {
            await fixerCb(res, autoFix);

            if (autoFix) {
                fixedIssues = true;
            } else {
                unrecoveredConsistencyErrors = true;
            }
        }
        catch (e) {
            logError(`Fixer failed with ${e.message} ${e.stack}`);
            unrecoveredConsistencyErrors = true;
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
            logError(`No parents found for note ${noteId}`);

            unrecoveredConsistencyErrors = true;
            return;
        }

        for (const parentNoteId of childToParents[noteId]) {
            if (path.includes(parentNoteId)) {
                logError(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);

                unrecoveredConsistencyErrors = true;
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
        unrecoveredConsistencyErrors = true;
    }
}

async function findBrokenReferenceIssues() {
    await findAndFixIssues(`
          SELECT branchId, branches.noteId
          FROM branches LEFT JOIN notes USING(noteId)
          WHERE branches.isDeleted = 0 AND notes.noteId IS NULL`,
        async ({branchId, noteId}, autoFix) => {
        if (autoFix) {
            const branch = await repository.getBranch(branchId);
            branch.isDeleted = true;
            await branch.save();

            logFix(`Branch ${branchId} has been deleted since it references missing note ${noteId}`);
        }
        else {
            logError(`Branch ${branchId} references missing note ${noteId}`);
        }
    });

    await findAndFixIssues(`
          SELECT branchId, branches.noteId AS parentNoteId
          FROM branches LEFT JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE branches.isDeleted = 0 AND branches.branchId != 'root' AND notes.noteId IS NULL`,
        async ({branchId, parentNoteId}, autoFix) => {
            if (autoFix) {
                const branch = await repository.getBranch(branchId);
                branch.parentNoteId = 'root';
                await branch.save();

                logFix(`Branch ${branchId} was set to root parent since it was referencing missing parent note ${parentNoteId}`);
            }
            else {
                logError(`Branch ${branchId} references missing parent note ${parentNoteId}`);
            }
        });

    await findAndFixIssues(`
          SELECT attributeId, attributes.noteId
          FROM attributes LEFT JOIN notes USING(noteId)
          WHERE attributes.isDeleted = 0 AND notes.noteId IS NULL`,
        async ({attributeId, noteId}, autoFix) => {
            if (autoFix) {
                const attribute = await repository.getAttribute(attributeId);
                attribute.isDeleted = true;
                await attribute.save();

                logFix(`Attribute ${attributeId} has been deleted since it references missing source note ${noteId}`);
            }
            else {
                logError(`Attribute ${attributeId} references missing source note ${noteId}`);
            }
        });

    await findAndFixIssues(`
          SELECT attributeId, attributes.value AS noteId
          FROM attributes LEFT JOIN notes ON notes.noteId = attributes.value
          WHERE attributes.isDeleted = 0 AND attributes.type = 'relation' 
            AND notes.noteId IS NULL`,
        async ({attributeId, noteId}, autoFix) => {
            if (autoFix) {
                const attribute = await repository.getAttribute(attributeId);
                attribute.isDeleted = true;
                await attribute.save();

                logFix(`Relation ${attributeId} has been deleted since it references missing note ${noteId}`)
            }
            else {
                logError(`Relation ${attributeId} references missing note ${noteId}`)
            }
        });

    await findIssues(`
          SELECT noteRevisionId, note_revisions.noteId
          FROM note_revisions LEFT JOIN notes USING(noteId)
          WHERE notes.noteId IS NULL`,
        ({noteRevisionId, noteId}) => `Note revision ${noteRevisionId} references missing note ${noteId}`);
}

async function findExistencyIssues() {
    // principle for fixing inconsistencies is that if the note itself is deleted (isDeleted=true) then all related entities should be also deleted (branches, attributes)
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
        async ({branchId, noteId}, autoFix) => {
            if (autoFix) {
                const branch = await repository.getBranch(branchId);
                branch.isDeleted = true;
                await branch.save();

                logFix(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
            }
            else {
                logError(`Branch ${branchId} is not deleted even though associated note ${noteId} is deleted.`)
            }
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
    `, async ({branchId, parentNoteId}, autoFix) => {
        if (autoFix) {
            const branch = await repository.getBranch(branchId);
            branch.isDeleted = true;
            await branch.save();

            logFix(`Branch ${branchId} has been deleted since associated parent note ${parentNoteId} is deleted.`);
        }
        else {
            logError(`Branch ${branchId} is not deleted even though associated parent note ${parentNoteId} is deleted.`)
        }
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
    `, async ({noteId}, autoFix) => {
        if (autoFix) {
            const branch = await new Branch({
                parentNoteId: 'root',
                noteId: noteId,
                prefix: 'recovered'
            }).save();

            logFix(`Created missing branch ${branch.branchId} for note ${noteId}`);
        }
        else {
            logError(`No undeleted branch found for note ${noteId}`);
        }
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
    async ({noteId, parentNoteId}, autoFix) => {
        if (autoFix) {
            const branches = await repository.getEntities(
                `SELECT *
                       FROM branches
                       WHERE noteId = ?
                         and parentNoteId = ?
                         and isDeleted = 0`, [noteId, parentNoteId]);

            // it's not necessarily "original" branch, it's just the only one which will survive
            const origBranch = branches[0];

            // delete all but the first branch
            for (const branch of branches.slice(1)) {
                branch.isDeleted = true;
                await branch.save();

                logFix(`Removing branch ${branch.branchId} since it's parent-child duplicate of branch ${origBranch.branchId}`);
            }
        }
        else {
            logError(`Duplicate branches for note ${noteId} and parent ${parentNoteId}`);
        }
    });
}

async function findLogicIssues() {
    await findAndFixIssues( `
          SELECT noteId, type 
          FROM notes 
          WHERE
            isDeleted = 0    
            AND type NOT IN ('text', 'code', 'render', 'file', 'image', 'search', 'relation-map', 'book')`,
        async ({noteId, type}, autoFix) => {
            if (autoFix) {
                const note = await repository.getNote(noteId);
                note.type = 'file'; // file is a safe option to recover notes if type is not known
                await note.save();

                logFix(`Note ${noteId} type has been change to file since it had invalid type=${type}`)
            }
            else {
                logError(`Note ${noteId} has invalid type=${type}`);
            }
        });

    await findAndFixIssues(`
                SELECT notes.noteId
                FROM notes
                  LEFT JOIN note_contents USING(noteId)
                WHERE
                  note_contents.noteId IS NULL`,
        async ({noteId}, autoFix) => {
            if (autoFix) {
                const note = await repository.getNote(noteId);
                // empty string might be wrong choice for some note types (and protected notes) but it's a best guess
                await note.setContent(note.isErased ? null : '');

                logFix(`Note ${noteId} content was set to empty string since there was no corresponding row`);
            }
            else {
                logError(`Note ${noteId} content row does not exist`);
            }
        });

    await findAndFixIssues(`
          SELECT noteId
          FROM notes
          JOIN note_contents USING(noteId)
          WHERE
            isDeleted = 0
            AND content IS NULL`,
        async ({noteId}, autoFix) => {
            if (autoFix) {
                const note = await repository.getNote(noteId);
                // empty string might be wrong choice for some note types (and protected notes) but it's a best guess
                await note.setContent('');

                logFix(`Note ${noteId} content was set to empty string since it was null even though it is not deleted`);
            }
            else {
                logError(`Note ${noteId} content is null even though it is not deleted`);
            }
        });

    await findIssues(`
          SELECT noteId
          FROM notes
          JOIN note_contents USING(noteId)
          WHERE
            isErased = 1
            AND content IS NOT NULL`,
        ({noteId}) => `Note ${noteId} content is not null even though the note is erased`);

    await findAndFixIssues(`
          SELECT noteId, noteRevisionId
          FROM notes
          JOIN note_revisions USING(noteId)
          WHERE
            notes.isErased = 1
            AND note_revisions.isErased = 0`,
        async ({noteId, noteRevisionId}, autoFix) => {
            if (autoFix) {
                const noteRevision = await repository.getNoteRevision(noteRevisionId);
                noteRevision.isErased = true;
                await noteRevision.setContent(null);
                await noteRevision.save();

                logFix(`Note revision ${noteRevisionId} has been erased since its note ${noteId} is also erased.`);
            }
            else {
                logError(`Note revision ${noteRevisionId} is not erased even though note ${noteId} is erased.`);
            }
        });

    await findAndFixIssues(`
                SELECT note_revisions.noteRevisionId
                FROM note_revisions
                LEFT JOIN note_revision_contents USING(noteRevisionId)
                WHERE note_revision_contents.noteRevisionId IS NULL`,
        async ({noteRevisionId}, autoFix) => {
            if (autoFix) {
                const noteRevision = await repository.getNoteRevision(noteRevisionId);
                await noteRevision.setContent(null);
                noteRevision.isErased = true;
                await noteRevision.save();

                logFix(`Note revision content ${noteRevisionId} was created and set to erased since it did not exist.`);
            }
            else {
                logError(`Note revision content ${noteRevisionId} does not exist`);
            }
        });

    await findAndFixIssues(`
          SELECT noteRevisionId
          FROM note_revisions
          JOIN note_revision_contents USING(noteRevisionId)
          WHERE
            isErased = 0
            AND content IS NULL`,
        async ({noteRevisionId}, autoFix) => {
            if (autoFix) {
                const noteRevision = await repository.getNoteRevision(noteRevisionId);
                noteRevision.isErased = true;
                await noteRevision.save();

                logFix(`Note revision ${noteRevisionId} content was set to empty string since it was null even though it is not erased`);
            }
            else {
                logError(`Note revision ${noteRevisionId} content is null even though it is not erased`);
            }
        });

    await findIssues(`
          SELECT noteRevisionId
          FROM note_revisions
          JOIN note_revision_contents USING(noteRevisionId)
          WHERE
            isErased = 1
            AND content IS NOT NULL`,
        ({noteRevisionId}) => `Note revision ${noteRevisionId} content is not null even though the note revision is erased`);

    await findIssues(`
        SELECT noteId
        FROM notes
        WHERE
            isErased = 1
            AND isDeleted = 0`,
        ({noteId}) => `Note ${noteId} is not deleted even though it is erased`);

    await findAndFixIssues(`
          SELECT parentNoteId
          FROM 
            branches
            JOIN notes ON notes.noteId = branches.parentNoteId
          WHERE
            notes.isDeleted = 0
            AND notes.type == 'search'
            AND branches.isDeleted = 0`,
        async ({parentNoteId}, autoFix) => {
            if (autoFix) {
                const branches = await repository.getEntities(`SELECT * FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [parentNoteId]);

                for (const branch of branches) {
                    branch.parentNoteId = 'root';
                    await branch.save();

                    logFix(`Child branch ${branch.branchId} has been moved to root since it was a child of a search note ${parentNoteId}`)
                }
            }
            else {
                logError(`Search note ${parentNoteId} has children`);
            }
        });

    await findAndFixIssues(`
          SELECT attributeId 
          FROM attributes 
          WHERE 
            isDeleted = 0 
            AND type = 'relation' 
            AND value = ''`,
        async ({attributeId}, autoFix) => {
            if (autoFix) {
                const relation = await repository.getAttribute(attributeId);
                relation.isDeleted = true;
                await relation.save();

                logFix(`Removed relation ${relation.attributeId} of name "${relation.name} with empty target.`);
            }
            else {
                logError(`Relation ${attributeId} has empty target.`);
            }
        });

    await findAndFixIssues(`
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
        async ({attributeId, type}, autoFix) => {
            if (autoFix) {
                const attribute = await repository.getAttribute(attributeId);
                attribute.type = 'label';
                await attribute.save();

                logFix(`Attribute ${attributeId} type was changed to label since it had invalid type '${type}'`);
            }
            else {
                logError(`Attribute ${attributeId} has invalid type '${type}'`);
            }
        });

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
        async ({attributeId, noteId}, autoFix) => {
            if (autoFix) {
                const attribute = await repository.getAttribute(attributeId);
                attribute.isDeleted = true;
                await attribute.save();

                logFix(`Removed attribute ${attributeId} because owning note ${noteId} is also deleted.`);
            }
            else {
                logError(`Attribute ${attributeId} is not deleted even though owning note ${noteId} is deleted.`);
            }
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
        async ({attributeId, targetNoteId}, autoFix) => {
            if (autoFix) {
                const attribute = await repository.getAttribute(attributeId);
                attribute.isDeleted = true;
                await attribute.save();

                logFix(`Removed attribute ${attributeId} because target note ${targetNoteId} is also deleted.`);
            }
            else {
                logError(`Attribute ${attributeId} is not deleted even though target note ${targetNoteId} is deleted.`);
            }
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
        async ({entityId}, autoFix) => {
            if (autoFix) {
                await syncTableService.addEntitySync(entityName, entityId);

                logFix(`Created missing sync record for entityName=${entityName}, entityId=${entityId}`);
            }
            else {
                logError(`Missing sync record for entityName=${entityName}, entityId=${entityId}`);
            }
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
        async ({id, entityId}, autoFix) => {
            if (autoFix) {
                await sql.execute("DELETE FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

                logFix(`Deleted extra sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
            }
            else {
                logError(`Unrecognized sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
            }
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
    unrecoveredConsistencyErrors = false;
    fixedIssues = false;

    await findBrokenReferenceIssues();

    await findExistencyIssues();

    await findLogicIssues();

    await findSyncRowsIssues();

    if (unrecoveredConsistencyErrors) {
        // we run this only if basic checks passed since this assumes basic data consistency

        await checkTreeCycles();
    }

    return !unrecoveredConsistencyErrors;
}

async function showEntityStat(name, query) {
    const map = await sql.getMap(query);

    map[0] = map[0] || 0;
    map[1] = map[1] || 0;

    log.info(`${name} deleted: ${map[1]}, not deleted ${map[0]}`);
}

async function runDbDiagnostics() {
    await showEntityStat("Notes", `SELECT isDeleted, count(noteId) FROM notes GROUP BY isDeleted`);
    await showEntityStat("Note revisions", `SELECT isErased, count(noteRevisionId) FROM note_revisions GROUP BY isErased`);
    await showEntityStat("Branches", `SELECT isDeleted, count(branchId) FROM branches GROUP BY isDeleted`);
    await showEntityStat("Attributes", `SELECT isDeleted, count(attributeId) FROM attributes GROUP BY isDeleted`);
    await showEntityStat("API tokens", `SELECT isDeleted, count(apiTokenId) FROM api_tokens GROUP BY isDeleted`);
}

async function runChecks() {
    let elapsedTimeMs;

    await syncMutexService.doExclusively(async () => {
        const startTime = new Date();

        await runDbDiagnostics();

        await runAllChecks();

        elapsedTimeMs = Date.now() - startTime.getTime();
    });

    if (fixedIssues) {
        ws.refreshTree();
    }

    if (unrecoveredConsistencyErrors) {
        log.info(`Consistency checks failed (took ${elapsedTimeMs}ms)`);

        ws.sendMessageToAllClients({type: 'consistency-checks-failed'});
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
    setTimeout(cls.wrap(runChecks), 20 * 1000);
});

module.exports = {};