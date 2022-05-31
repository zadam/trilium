"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const log = require('./log');
const ws = require('./ws');
const syncMutexService = require('./sync_mutex');
const cls = require('./cls');
const entityChangesService = require('./entity_changes');
const optionsService = require('./options');
const Branch = require('../becca/entities/branch');
const attributeService = require('./attributes');
const noteRevisionService = require('./note_revisions');
const becca = require("../becca/becca");
const utils = require("../services/utils");
const noteTypes = require("../services/note_types");

class ConsistencyChecks {
    constructor(autoFix) {
        this.autoFix = autoFix;
        this.unrecoveredConsistencyErrors = false;
        this.fixedIssues = false;
        this.reloadNeeded = false;
    }

    findAndFixIssues(query, fixerCb) {
        const results = sql.getRows(query);

        for (const res of results) {
            try {
                sql.transactional(() => fixerCb(res));

                if (this.autoFix) {
                    this.fixedIssues = true;
                } else {
                    this.unrecoveredConsistencyErrors = true;
                }
            } catch (e) {
                logError(`Fixer failed with ${e.message} ${e.stack}`);
                this.unrecoveredConsistencyErrors = true;
            }
        }

        return results;
    }

    checkTreeCycles() {
        const childToParents = {};
        const rows = sql.getRows("SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0");

        for (const row of rows) {
            const childNoteId = row.noteId;
            const parentNoteId = row.parentNoteId;

            childToParents[childNoteId] = childToParents[childNoteId] || [];
            childToParents[childNoteId].push(parentNoteId);
        }

        /** @returns {boolean} true if cycle was found and we should try again */
        const checkTreeCycle = (noteId, path) => {
            if (noteId === 'root') {
                return false;
            }

            for (const parentNoteId of childToParents[noteId]) {
                if (path.includes(parentNoteId)) {
                    if (this.autoFix) {
                        const branch = becca.getBranchFromChildAndParent(noteId, parentNoteId);
                        branch.markAsDeleted('cycle-autofix');
                        logFix(`Branch '${branch.branchId}' between child '${noteId}' and parent '${parentNoteId}' has been deleted since it was causing a tree cycle.`);

                        return true;
                    }
                    else {
                        logError(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);

                        this.unrecoveredConsistencyErrors = true;
                    }
                } else {
                    const newPath = path.slice();
                    newPath.push(noteId);

                    const retryNeeded = checkTreeCycle(parentNoteId, newPath);

                    if (retryNeeded) {
                        return true;
                    }
                }
            }

            return false;
        };

        const noteIds = Object.keys(childToParents);

        for (const noteId of noteIds) {
            const retryNeeded = checkTreeCycle(noteId, []);

            if (retryNeeded) {
                return true;
            }
        }

        return false;
    }

    checkAndRepairTreeCycles() {
        let treeFixed = false;

        while (this.checkTreeCycles()) {
            // fixing cycle means deleting branches, we might need to create a new branch to recover the note
            this.findExistencyIssues();

            treeFixed = true;
        }

        if (treeFixed) {
            this.reloadNeeded = true;
        }
    }

    findBrokenReferenceIssues() {
        this.findAndFixIssues(`
                    SELECT branchId, branches.noteId
                    FROM branches
                      LEFT JOIN notes USING (noteId)
                    WHERE branches.isDeleted = 0
                      AND notes.noteId IS NULL`,
            ({branchId, noteId}) => {
                if (this.autoFix) {
                    const branch = becca.getBranch(branchId);
                    branch.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Branch ${branchId} has been deleted since it references missing note ${noteId}`);
                } else {
                    logError(`Branch ${branchId} references missing note ${noteId}`);
                }
            });

        this.findAndFixIssues(`
                    SELECT branchId, branches.noteId AS parentNoteId
                    FROM branches
                      LEFT JOIN notes ON notes.noteId = branches.parentNoteId
                    WHERE branches.isDeleted = 0
                      AND branches.branchId != 'root'
                      AND notes.noteId IS NULL`,
            ({branchId, parentNoteId}) => {
                if (this.autoFix) {
                    const branch = becca.getBranch(branchId);
                    branch.parentNoteId = 'root';
                    branch.save();

                    this.reloadNeeded = true;

                    logFix(`Branch ${branchId} was set to root parent since it was referencing missing parent note ${parentNoteId}`);
                } else {
                    logError(`Branch ${branchId} references missing parent note ${parentNoteId}`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId, attributes.noteId
                    FROM attributes
                      LEFT JOIN notes USING (noteId)
                    WHERE attributes.isDeleted = 0
                      AND notes.noteId IS NULL`,
            ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = becca.getAttribute(attributeId);
                    attribute.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Attribute ${attributeId} has been deleted since it references missing source note ${noteId}`);
                } else {
                    logError(`Attribute ${attributeId} references missing source note ${noteId}`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId, attributes.value AS noteId
                    FROM attributes
                      LEFT JOIN notes ON notes.noteId = attributes.value
                    WHERE attributes.isDeleted = 0
                      AND attributes.type = 'relation'
                      AND notes.noteId IS NULL`,
            ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = becca.getAttribute(attributeId);
                    attribute.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Relation ${attributeId} has been deleted since it references missing note ${noteId}`)
                } else {
                    logError(`Relation ${attributeId} references missing note ${noteId}`)
                }
            });
    }

    findExistencyIssues() {
        // principle for fixing inconsistencies is that if the note itself is deleted (isDeleted=true) then all related entities should be also deleted (branches, attributes)
        // but if note is not deleted, then at least one branch should exist.

        // the order here is important - first we might need to delete inconsistent branches and after that
        // another check might create missing branch
        this.findAndFixIssues(`
                    SELECT branchId,
                           noteId
                    FROM branches
                      JOIN notes USING (noteId)
                    WHERE notes.isDeleted = 1
                      AND branches.isDeleted = 0`,
            ({branchId, noteId}) => {
                if (this.autoFix) {
                    const branch = becca.getBranch(branchId);
                    branch.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
                } else {
                    logError(`Branch ${branchId} is not deleted even though associated note ${noteId} is deleted.`)
                }
            });

        this.findAndFixIssues(`
            SELECT branchId,
                   parentNoteId
            FROM branches
              JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
            WHERE parentNote.isDeleted = 1
              AND branches.isDeleted = 0
        `, ({branchId, parentNoteId}) => {
            if (this.autoFix) {
                const branch = becca.getBranch(branchId);
                branch.markAsDeleted();

                this.reloadNeeded = true;

                logFix(`Branch ${branchId} has been deleted since associated parent note ${parentNoteId} is deleted.`);
            } else {
                logError(`Branch ${branchId} is not deleted even though associated parent note ${parentNoteId} is deleted.`)
            }
        });

        this.findAndFixIssues(`
            SELECT DISTINCT notes.noteId
            FROM notes
              LEFT JOIN branches ON notes.noteId = branches.noteId AND branches.isDeleted = 0
            WHERE notes.isDeleted = 0
              AND branches.branchId IS NULL
        `, ({noteId}) => {
            if (this.autoFix) {
                const branch = new Branch({
                    parentNoteId: 'root',
                    noteId: noteId,
                    prefix: 'recovered'
                }).save();

                this.reloadNeeded = true;

                logFix(`Created missing branch ${branch.branchId} for note ${noteId}`);
            } else {
                logError(`No undeleted branch found for note ${noteId}`);
            }
        });

        // there should be a unique relationship between note and its parent
        this.findAndFixIssues(`
                    SELECT noteId,
                           parentNoteId
                    FROM branches
                    WHERE branches.isDeleted = 0
                    GROUP BY branches.parentNoteId,
                             branches.noteId
                    HAVING COUNT(1) > 1`,
            ({noteId, parentNoteId}) => {
                if (this.autoFix) {
                    const branchIds = sql.getColumn(
                            `SELECT branchId
                             FROM branches
                             WHERE noteId = ?
                               and parentNoteId = ?
                               and isDeleted = 0
                             ORDER BY utcDateModified`, [noteId, parentNoteId]);

                    const branches = branchIds.map(branchId => becca.getBranch(branchId));

                    // it's not necessarily "original" branch, it's just the only one which will survive
                    const origBranch = branches[0];

                    // delete all but the first branch
                    for (const branch of branches.slice(1)) {
                        branch.markAsDeleted();

                        logFix(`Removing branch ${branch.branchId} since it's parent-child duplicate of branch ${origBranch.branchId}`);
                    }

                    this.reloadNeeded = true;
                } else {
                    logError(`Duplicate branches for note ${noteId} and parent ${parentNoteId}`);
                }
            });
    }

    findLogicIssues() {
        const noteTypesStr = noteTypes.map(nt => `'${nt}'`).join(", ");

        this.findAndFixIssues(`
                    SELECT noteId, type
                    FROM notes
                    WHERE isDeleted = 0
                      AND type NOT IN (${noteTypesStr})`,
            ({noteId, type}) => {
                if (this.autoFix) {
                    const note = becca.getNote(noteId);
                    note.type = 'file'; // file is a safe option to recover notes if type is not known
                    note.save();

                    this.reloadNeeded = true;

                    logFix(`Note ${noteId} type has been change to file since it had invalid type=${type}`)
                } else {
                    logError(`Note ${noteId} has invalid type=${type}`);
                }
            });

        this.findAndFixIssues(`
                    SELECT notes.noteId, notes.isProtected, notes.type, notes.mime
                    FROM notes
                      LEFT JOIN note_contents USING (noteId)
                    WHERE note_contents.noteId IS NULL`,
            ({noteId, isProtected, type, mime}) => {
                if (this.autoFix) {
                    // it might be possible that the note_content is not available only because of the interrupted
                    // sync and it will come later. It's therefore important to guarantee that this artifical
                    // record won't overwrite the real one coming from the sync.
                    const fakeDate = "2000-01-01 00:00:00Z";

                    // manually creating row since this can also affect deleted notes
                    sql.upsert("note_contents", "noteId", {
                        noteId: noteId,
                        content: getBlankContent(isProtected, type, mime),
                        utcDateModified: fakeDate,
                        dateModified: fakeDate
                    });

                    const hash = utils.hash(utils.randomString(10));

                    entityChangesService.addEntityChange({
                        entityName: 'note_contents',
                        entityId: noteId,
                        hash: hash,
                        isErased: false,
                        utcDateChanged: fakeDate,
                        isSynced: true
                    });

                    this.reloadNeeded = true;

                    logFix(`Note ${noteId} content was set to empty string since there was no corresponding row`);
                } else {
                    logError(`Note ${noteId} content row does not exist`);
                }
            });

        if (sqlInit.getDbSize() < 500000) {
            // querying for "content IS NULL" is expensive since content is not indexed. See e.g. https://github.com/zadam/trilium/issues/2887

            this.findAndFixIssues(`
                        SELECT notes.noteId, notes.type, notes.mime
                        FROM notes
                                 JOIN note_contents USING (noteId)
                        WHERE isDeleted = 0
                          AND isProtected = 0
                          AND content IS NULL`,
                ({noteId, type, mime}) => {
                    if (this.autoFix) {
                        const note = becca.getNote(noteId);
                        const blankContent = getBlankContent(false, type, mime);
                        note.setContent(blankContent);

                        this.reloadNeeded = true;

                        logFix(`Note ${noteId} content was set to "${blankContent}" since it was null even though it is not deleted`);
                    } else {
                        logError(`Note ${noteId} content is null even though it is not deleted`);
                    }
                });
        }

        this.findAndFixIssues(`
                    SELECT note_revisions.noteRevisionId
                    FROM note_revisions
                      LEFT JOIN note_revision_contents USING (noteRevisionId)
                    WHERE note_revision_contents.noteRevisionId IS NULL
                      AND note_revisions.isProtected = 0`,
            ({noteRevisionId}) => {
                if (this.autoFix) {
                    noteRevisionService.eraseNoteRevisions([noteRevisionId]);

                    this.reloadNeeded = true;

                    logFix(`Note revision content ${noteRevisionId} was created and set to erased since it did not exist.`);
                } else {
                    logError(`Note revision content ${noteRevisionId} does not exist`);
                }
            });

        this.findAndFixIssues(`
                    SELECT parentNoteId
                    FROM branches
                      JOIN notes ON notes.noteId = branches.parentNoteId
                    WHERE notes.isDeleted = 0
                      AND notes.type == 'search'
                      AND branches.isDeleted = 0`,
            ({parentNoteId}) => {
                if (this.autoFix) {
                    const branchIds = sql.getColumn(`
                        SELECT branchId
                        FROM branches
                        WHERE isDeleted = 0
                          AND parentNoteId = ?`, [parentNoteId]);

                    const branches = branchIds.map(branchId => becca.getBranch(branchId));

                    for (const branch of branches) {
                        branch.parentNoteId = 'root';
                        branch.save();

                        logFix(`Child branch ${branch.branchId} has been moved to root since it was a child of a search note ${parentNoteId}`)
                    }

                    this.reloadNeeded = true;
                } else {
                    logError(`Search note ${parentNoteId} has children`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId
                    FROM attributes
                    WHERE isDeleted = 0
                      AND type = 'relation'
                      AND value = ''`,
            ({attributeId}) => {
                if (this.autoFix) {
                    const relation = becca.getAttribute(attributeId);
                    relation.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Removed relation ${relation.attributeId} of name "${relation.name} with empty target.`);
                } else {
                    logError(`Relation ${attributeId} has empty target.`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId,
                           type
                    FROM attributes
                    WHERE isDeleted = 0
                      AND type != 'label'
                      AND type != 'relation'`,
            ({attributeId, type}) => {
                if (this.autoFix) {
                    const attribute = becca.getAttribute(attributeId);
                    attribute.type = 'label';
                    attribute.save();

                    this.reloadNeeded = true;

                    logFix(`Attribute ${attributeId} type was changed to label since it had invalid type '${type}'`);
                } else {
                    logError(`Attribute ${attributeId} has invalid type '${type}'`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId,
                           attributes.noteId
                    FROM attributes
                    JOIN notes ON attributes.noteId = notes.noteId
                    WHERE attributes.isDeleted = 0
                      AND notes.isDeleted = 1`,
            ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = becca.getAttribute(attributeId);
                    attribute.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Removed attribute ${attributeId} because owning note ${noteId} is also deleted.`);
                } else {
                    logError(`Attribute ${attributeId} is not deleted even though owning note ${noteId} is deleted.`);
                }
            });

        this.findAndFixIssues(`
                    SELECT attributeId,
                           attributes.value AS targetNoteId
                    FROM attributes
                    JOIN notes ON attributes.value = notes.noteId
                    WHERE attributes.type = 'relation'
                      AND attributes.isDeleted = 0
                      AND notes.isDeleted = 1`,
            ({attributeId, targetNoteId}) => {
                if (this.autoFix) {
                    const attribute = becca.getAttribute(attributeId);
                    attribute.markAsDeleted();

                    this.reloadNeeded = true;

                    logFix(`Removed attribute ${attributeId} because target note ${targetNoteId} is also deleted.`);
                } else {
                    logError(`Attribute ${attributeId} is not deleted even though target note ${targetNoteId} is deleted.`);
                }
            });
    }

    runEntityChangeChecks(entityName, key) {
        this.findAndFixIssues(`
            SELECT
              ${key} as entityId
            FROM
              ${entityName} 
              LEFT JOIN entity_changes ON entity_changes.entityName = '${entityName}' 
                                      AND entity_changes.entityId = ${key} 
            WHERE 
              entity_changes.id IS NULL`,
            ({entityId}) => {
                const entity = sql.getRow(`SELECT * FROM ${entityName} WHERE ${key} = ?`, [entityId]);

                if (this.autoFix) {
                    entityChangesService.addEntityChange({
                        entityName,
                        entityId,
                        hash: utils.randomString(10), // doesn't matter, will force sync but that's OK
                        isErased: !!entity.isErased,
                        utcDateChanged: entity.utcDateModified || entity.utcDateCreated,
                        isSynced: entityName !== 'options' || entity.isSynced
                    });

                    logFix(`Created missing entity change for entityName=${entityName}, entityId=${entityId}`);
                } else {
                    logError(`Missing entity change for entityName=${entityName}, entityId=${entityId}`);
                }
            });

        this.findAndFixIssues(`
            SELECT 
              id, entityId
            FROM 
              entity_changes 
              LEFT JOIN ${entityName} ON entityId = ${key} 
            WHERE
              entity_changes.isErased = 0
              AND entity_changes.entityName = '${entityName}' 
              AND ${key} IS NULL`,
                ({id, entityId}) => {
                    if (this.autoFix) {
                        sql.execute("DELETE FROM entity_changes WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

                        logFix(`Deleted extra entity change id=${id}, entityName=${entityName}, entityId=${entityId}`);
                    } else {
                        logError(`Unrecognized entity change id=${id}, entityName=${entityName}, entityId=${entityId}`);
                    }
                });

        this.findAndFixIssues(`
            SELECT 
              id, entityId
            FROM 
              entity_changes 
              JOIN ${entityName} ON entityId = ${key} 
            WHERE
              entity_changes.isErased = 1
              AND entity_changes.entityName = '${entityName}'`,
            ({id, entityId}) => {
                if (this.autoFix) {
                    sql.execute(`DELETE FROM ${entityName} WHERE ${key} = ?`, [entityId]);

                    this.reloadNeeded = true;

                    logFix(`Erasing entityName=${entityName}, entityId=${entityId} since entity change id=${id} has it as erased.`);
                } else {
                    logError(`Entity change id=${id} has entityName=${entityName}, entityId=${entityId} as erased, but it's not.`);
                }
            });
    }

    findEntityChangeIssues() {
        this.runEntityChangeChecks("notes", "noteId");
        this.runEntityChangeChecks("note_contents", "noteId");
        this.runEntityChangeChecks("note_revisions", "noteRevisionId");
        this.runEntityChangeChecks("branches", "branchId");
        this.runEntityChangeChecks("attributes", "attributeId");
        this.runEntityChangeChecks("etapi_tokens", "etapiTokenId");
        this.runEntityChangeChecks("options", "name");
    }

    findWronglyNamedAttributes() {
        const attrNames = sql.getColumn(`SELECT DISTINCT name FROM attributes`);

        for (const origName of attrNames) {
            const fixedName = attributeService.sanitizeAttributeName(origName);

            if (fixedName !== origName) {
                if (this.autoFix) {
                    // there isn't a good way to update this:
                    // - just SQL query will fix it in DB but not notify frontend (or other caches) that it has been fixed
                    // - renaming the attribute would break the invariant that single attribute never changes the name
                    // - deleting the old attribute and creating new will create duplicates across synchronized cluster (specifically in the initial migration)
                    // But in general we assume there won't be many such problems
                    sql.execute('UPDATE attributes SET name = ? WHERE name = ?', [fixedName, origName]);

                    this.fixedIssues = true;
                    this.reloadNeeded = true;

                    logFix(`Renamed incorrectly named attributes "${origName}" to ${fixedName}`);
                }
                else {
                    this.unrecoveredConsistencyErrors = true;

                    logFix(`There are incorrectly named attributes "${origName}"`);
                }
            }
        }
    }

    findSyncIssues() {
        const lastSyncedPush = parseInt(sql.getValue("SELECT value FROM options WHERE name = 'lastSyncedPush'"));
        const maxEntityChangeId = sql.getValue("SELECT MAX(id) FROM entity_changes");

        if (lastSyncedPush > maxEntityChangeId) {
            if (this.autoFix) {
                sql.execute("UPDATE options SET value = ? WHERE name = 'lastSyncedPush'", [maxEntityChangeId]);

                this.fixedIssues = true;

                logFix(`Fixed incorrect lastSyncedPush - was ${lastSyncedPush}, needs to be at maximum ${maxEntityChangeId}`);
            }
            else {
                this.unrecoveredConsistencyErrors = true;

                logFix(`Incorrect lastSyncedPush - is ${lastSyncedPush}, needs to be at maximum ${maxEntityChangeId}`);
            }
        }
    }

    runAllChecksAndFixers() {
        this.unrecoveredConsistencyErrors = false;
        this.fixedIssues = false;
        this.reloadNeeded = false;

        this.findEntityChangeIssues();

        this.findBrokenReferenceIssues();

        this.findExistencyIssues();

        this.findLogicIssues();

        this.findWronglyNamedAttributes();

        this.findSyncIssues();

        // root branch should always be expanded
        sql.execute("UPDATE branches SET isExpanded = 1 WHERE branchId = 'root'");

        if (!this.unrecoveredConsistencyErrors) {
            // we run this only if basic checks passed since this assumes basic data consistency

            this.checkAndRepairTreeCycles();
        }

        if (this.reloadNeeded) {
            require("../becca/becca_loader").reload();
        }

        return !this.unrecoveredConsistencyErrors;
    }

    runDbDiagnostics() {
        function getTableRowCount(tableName) {
            const count = sql.getValue(`SELECT COUNT(1) FROM ${tableName}`);

            return `${tableName}: ${count}`;
        }

        const tables = [ "notes", "note_revisions", "branches", "attributes", "etapi_tokens" ];

        log.info("Table counts: " + tables.map(tableName => getTableRowCount(tableName)).join(", "));
    }

    async runChecks() {
        let elapsedTimeMs;

        await syncMutexService.doExclusively(() => {
            const startTimeMs = Date.now();

            this.runDbDiagnostics();

            this.runAllChecksAndFixers();

            elapsedTimeMs = Date.now() - startTimeMs;
        });

        if (this.unrecoveredConsistencyErrors) {
            log.info(`Consistency checks failed (took ${elapsedTimeMs}ms)`);

            ws.sendMessageToAllClients({type: 'consistency-checks-failed'});
        } else {
            log.info(`All consistency checks passed ` +
                (this.fixedIssues ? "after some fixes" : "with no errors detected") +
                ` (took ${elapsedTimeMs}ms)`
            );
        }
    }
}

function getBlankContent(isProtected, type, mime) {
    if (isProtected) {
        return null; // this is wrong for protected non-erased notes, but we cannot create a valid value without password
    }

    if (mime === 'application/json') {
        return '{}';
    }

    return ''; // empty string might be wrong choice for some note types, but it's the best guess
}

function logFix(message) {
    log.info("Consistency issue fixed: " + message);
}

function logError(message) {
    log.info("Consistency error: " + message);
}

function runPeriodicChecks() {
    const autoFix = optionsService.getOptionBool('autoFixConsistencyIssues');

    const consistencyChecks = new ConsistencyChecks(autoFix);
    consistencyChecks.runChecks();
}

function runOnDemandChecks(autoFix) {
    const consistencyChecks = new ConsistencyChecks(autoFix);
    consistencyChecks.runChecks();
}

function runEntityChangesChecks() {
    const consistencyChecks = new ConsistencyChecks(true);
    consistencyChecks.findEntityChangeIssues();
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(runPeriodicChecks), 60 * 60 * 1000);

    // kickoff checks soon after startup (to not block the initial load)
    setTimeout(cls.wrap(runPeriodicChecks), 4 * 1000);
});

module.exports = {
    runOnDemandChecks,
    runEntityChangesChecks
};
