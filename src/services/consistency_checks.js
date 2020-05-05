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
const dateUtils = require('./date_utils');

class ConsistencyChecks {
    constructor(autoFix) {
        this.autoFix = autoFix;
        this.unrecoveredConsistencyErrors = false;
        this.fixedIssues = false;
    }

    async findAndFixIssues(query, fixerCb) {
        const results = await sql.getRows(query);

        for (const res of results) {
            try {
                await fixerCb(res);

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

    async checkTreeCycles() {
        const childToParents = {};
        const rows = await sql.getRows("SELECT noteId, parentNoteId FROM branches WHERE isDeleted = 0");

        for (const row of rows) {
            const childNoteId = row.noteId;
            const parentNoteId = row.parentNoteId;

            childToParents[childNoteId] = childToParents[childNoteId] || [];
            childToParents[childNoteId].push(parentNoteId);
        }

        const checkTreeCycle = (noteId, path) => {
            if (noteId === 'root') {
                return;
            }

            if (!childToParents[noteId] || childToParents[noteId].length === 0) {
                logError(`No parents found for note ${noteId}`);

                this.unrecoveredConsistencyErrors = true;
                return;
            }

            for (const parentNoteId of childToParents[noteId]) {
                if (path.includes(parentNoteId)) {
                    logError(`Tree cycle detected at parent-child relationship: ${parentNoteId} - ${noteId}, whole path: ${path}`);

                    this.unrecoveredConsistencyErrors = true;
                } else {
                    const newPath = path.slice();
                    newPath.push(noteId);

                    checkTreeCycle(parentNoteId, newPath);
                }
            }
        };

        const noteIds = Object.keys(childToParents);

        for (const noteId of noteIds) {
            checkTreeCycle(noteId, []);
        }

        if (childToParents['root'].length !== 1 || childToParents['root'][0] !== 'none') {
            logError('Incorrect root parent: ' + JSON.stringify(childToParents['root']));
            this.unrecoveredConsistencyErrors = true;
        }
    }

    async findBrokenReferenceIssues() {
        await this.findAndFixIssues(`
                    SELECT branchId, branches.noteId
                    FROM branches
                             LEFT JOIN notes USING (noteId)
                    WHERE branches.isDeleted = 0
                      AND notes.noteId IS NULL`,
            async ({branchId, noteId}) => {
                if (this.autoFix) {
                    const branch = await repository.getBranch(branchId);
                    branch.isDeleted = true;
                    await branch.save();

                    logFix(`Branch ${branchId} has been deleted since it references missing note ${noteId}`);
                } else {
                    logError(`Branch ${branchId} references missing note ${noteId}`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT branchId, branches.noteId AS parentNoteId
                    FROM branches
                             LEFT JOIN notes ON notes.noteId = branches.parentNoteId
                    WHERE branches.isDeleted = 0
                      AND branches.branchId != 'root'
                      AND notes.noteId IS NULL`,
            async ({branchId, parentNoteId}) => {
                if (this.autoFix) {
                    const branch = await repository.getBranch(branchId);
                    branch.parentNoteId = 'root';
                    await branch.save();

                    logFix(`Branch ${branchId} was set to root parent since it was referencing missing parent note ${parentNoteId}`);
                } else {
                    logError(`Branch ${branchId} references missing parent note ${parentNoteId}`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId, attributes.noteId
                    FROM attributes
                             LEFT JOIN notes USING (noteId)
                    WHERE attributes.isDeleted = 0
                      AND notes.noteId IS NULL`,
            async ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = await repository.getAttribute(attributeId);
                    attribute.isDeleted = true;
                    await attribute.save();

                    logFix(`Attribute ${attributeId} has been deleted since it references missing source note ${noteId}`);
                } else {
                    logError(`Attribute ${attributeId} references missing source note ${noteId}`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId, attributes.value AS noteId
                    FROM attributes
                             LEFT JOIN notes ON notes.noteId = attributes.value
                    WHERE attributes.isDeleted = 0
                      AND attributes.type = 'relation'
                      AND notes.noteId IS NULL`,
            async ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = await repository.getAttribute(attributeId);
                    attribute.isDeleted = true;
                    await attribute.save();

                    logFix(`Relation ${attributeId} has been deleted since it references missing note ${noteId}`)
                } else {
                    logError(`Relation ${attributeId} references missing note ${noteId}`)
                }
            });
    }

    async findExistencyIssues() {
        // principle for fixing inconsistencies is that if the note itself is deleted (isDeleted=true) then all related entities should be also deleted (branches, attributes)
        // but if note is not deleted, then at least one branch should exist.

        // the order here is important - first we might need to delete inconsistent branches and after that
        // another check might create missing branch
        await this.findAndFixIssues(`
                    SELECT branchId,
                           noteId
                    FROM branches
                             JOIN notes USING (noteId)
                    WHERE notes.isDeleted = 1
                      AND branches.isDeleted = 0`,
            async ({branchId, noteId}) => {
                if (this.autoFix) {
                    const branch = await repository.getBranch(branchId);
                    branch.isDeleted = true;
                    await branch.save();

                    logFix(`Branch ${branchId} has been deleted since associated note ${noteId} is deleted.`);
                } else {
                    logError(`Branch ${branchId} is not deleted even though associated note ${noteId} is deleted.`)
                }
            });

        await this.findAndFixIssues(`
            SELECT branchId,
                   parentNoteId
            FROM branches
                     JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
            WHERE parentNote.isDeleted = 1
              AND branches.isDeleted = 0
        `, async ({branchId, parentNoteId}) => {
            if (this.autoFix) {
                const branch = await repository.getBranch(branchId);
                branch.isDeleted = true;
                await branch.save();

                logFix(`Branch ${branchId} has been deleted since associated parent note ${parentNoteId} is deleted.`);
            } else {
                logError(`Branch ${branchId} is not deleted even though associated parent note ${parentNoteId} is deleted.`)
            }
        });

        await this.findAndFixIssues(`
            SELECT DISTINCT notes.noteId
            FROM notes
                     LEFT JOIN branches ON notes.noteId = branches.noteId AND branches.isDeleted = 0
            WHERE notes.isDeleted = 0
              AND branches.branchId IS NULL
        `, async ({noteId}) => {
            if (this.autoFix) {
                const branch = await new Branch({
                    parentNoteId: 'root',
                    noteId: noteId,
                    prefix: 'recovered'
                }).save();

                logFix(`Created missing branch ${branch.branchId} for note ${noteId}`);
            } else {
                logError(`No undeleted branch found for note ${noteId}`);
            }
        });

        // there should be a unique relationship between note and its parent
        await this.findAndFixIssues(`
                    SELECT noteId,
                           parentNoteId
                    FROM branches
                    WHERE branches.isDeleted = 0
                    GROUP BY branches.parentNoteId,
                             branches.noteId
                    HAVING COUNT(1) > 1`,
            async ({noteId, parentNoteId}) => {
                if (this.autoFix) {
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
                } else {
                    logError(`Duplicate branches for note ${noteId} and parent ${parentNoteId}`);
                }
            });
    }

    async findLogicIssues() {
        await this.findAndFixIssues(`
                    SELECT noteId, type
                    FROM notes
                    WHERE isDeleted = 0
                      AND type NOT IN ('text', 'code', 'render', 'file', 'image', 'search', 'relation-map', 'book')`,
            async ({noteId, type}) => {
                if (this.autoFix) {
                    const note = await repository.getNote(noteId);
                    note.type = 'file'; // file is a safe option to recover notes if type is not known
                    await note.save();

                    logFix(`Note ${noteId} type has been change to file since it had invalid type=${type}`)
                } else {
                    logError(`Note ${noteId} has invalid type=${type}`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT notes.noteId
                    FROM notes
                             LEFT JOIN note_contents USING (noteId)
                    WHERE note_contents.noteId IS NULL`,
            async ({noteId}) => {
                if (this.autoFix) {
                    const note = await repository.getNote(noteId);

                    if (note.isProtected) {
                        // this is wrong for non-erased notes but we cannot set a valid value for protected notes
                        await sql.upsert("note_contents", "noteId", {
                            noteId: noteId,
                            content: null,
                            hash: "consistency_checks",
                            utcDateModified: dateUtils.utcNowDateTime()
                        });

                        await syncTableService.addNoteContentSync(noteId);
                    }
                    else {
                        // empty string might be wrong choice for some note types but it's a best guess
                        await note.setContent(note.isErased ? null : '');
                    }

                    logFix(`Note ${noteId} content was set to empty string since there was no corresponding row`);
                } else {
                    logError(`Note ${noteId} content row does not exist`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT noteId
                    FROM notes
                             JOIN note_contents USING (noteId)
                    WHERE isDeleted = 0
                      AND isProtected = 0
                      AND content IS NULL`,
            async ({noteId}) => {
                if (this.autoFix) {
                    const note = await repository.getNote(noteId);
                    // empty string might be wrong choice for some note types but it's a best guess
                    await note.setContent('');

                    logFix(`Note ${noteId} content was set to empty string since it was null even though it is not deleted`);
                } else {
                    logError(`Note ${noteId} content is null even though it is not deleted`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT noteId
                    FROM notes
                             JOIN note_contents USING (noteId)
                    WHERE isErased = 1
                      AND content IS NOT NULL`,
            async ({noteId}) => {

            // we always fix this issue because there does not seem to be a good way to prevent it.
            // Scenario in which this can happen:
            // 1. user on instance A deletes the note (sync for notes is created, but not for note_contents) and is later erased
            // 2. instance B gets synced from instance A, note is updated because of sync row for notes,
            //    but note_contents is not because erasion does not create sync rows
            // 3. therefore note.isErased = true, but note_contents.content remains not updated and not erased.
            //
            // Considered solutions:
            // - don't sync erased notes - this might prevent syncing also of the isDeleted flag and note would continue
            //   to exist on the other instance
            // - create sync rows for erased event - this would be a problem for undeletion since erasion might happen
            //   on one instance after undelete and thus would win even though there's no user action behind it
            //
            // So instead we just fix such cases afterwards here.

            await sql.execute(`UPDATE note_contents SET content = NULL WHERE noteId = ?`, [noteId]);

            logFix(`Note ${noteId} content has been set to null since the note is erased`);
        });

        await this.findAndFixIssues(`
                    SELECT noteId, noteRevisionId
                    FROM notes
                             JOIN note_revisions USING (noteId)
                    WHERE notes.isErased = 1
                      AND note_revisions.isErased = 0`,
            async ({noteId, noteRevisionId}) => {
                if (this.autoFix) {
                    const noteRevision = await repository.getNoteRevision(noteRevisionId);
                    noteRevision.isErased = true;
                    await noteRevision.setContent(null);
                    await noteRevision.save();

                    logFix(`Note revision ${noteRevisionId} has been erased since its note ${noteId} is also erased.`);
                } else {
                    logError(`Note revision ${noteRevisionId} is not erased even though note ${noteId} is erased.`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT note_revisions.noteRevisionId
                    FROM note_revisions
                             LEFT JOIN note_revision_contents USING (noteRevisionId)
                    WHERE note_revision_contents.noteRevisionId IS NULL
                      AND note_revisions.isProtected = 0`,
            async ({noteRevisionId}) => {
                if (this.autoFix) {
                    const noteRevision = await repository.getNoteRevision(noteRevisionId);
                    await noteRevision.setContent(null);
                    noteRevision.isErased = true;
                    await noteRevision.save();

                    logFix(`Note revision content ${noteRevisionId} was created and set to erased since it did not exist.`);
                } else {
                    logError(`Note revision content ${noteRevisionId} does not exist`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT noteRevisionId
                    FROM note_revisions
                             JOIN note_revision_contents USING (noteRevisionId)
                    WHERE isErased = 0
                      AND content IS NULL`,
            async ({noteRevisionId}) => {
                if (this.autoFix) {
                    const noteRevision = await repository.getNoteRevision(noteRevisionId);
                    noteRevision.isErased = true;
                    await noteRevision.save();

                    logFix(`Note revision ${noteRevisionId} content was set to empty string since it was null even though it is not erased`);
                } else {
                    logError(`Note revision ${noteRevisionId} content is null even though it is not erased`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT noteRevisionId
                    FROM note_revisions
                             JOIN note_revision_contents USING (noteRevisionId)
                    WHERE isErased = 1
                      AND content IS NOT NULL`,
            async ({noteRevisionId}) => {
                if (this.autoFix) {
                    await sql.execute(`UPDATE note_revision_contents SET content = NULL WHERE noteRevisionId = ?`, [noteRevisionId]);

                    logFix(`Note revision ${noteRevisionId} content was set to null since the note revision is erased`);
                }
                else {
                    logError(`Note revision ${noteRevisionId} content is not null even though the note revision is erased`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT noteId
                    FROM notes
                    WHERE isErased = 1
                      AND isDeleted = 0`,
            async ({noteId}) => {
                if (this.autoFix) {
                    const note = await repository.getNote(noteId);
                    note.isDeleted = true;
                    await note.save();

                    logFix(`Note ${noteId} was set to deleted since it is erased`);
                }
                else {
                    logError(`Note ${noteId} is not deleted even though it is erased`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT parentNoteId
                    FROM branches
                             JOIN notes ON notes.noteId = branches.parentNoteId
                    WHERE notes.isDeleted = 0
                      AND notes.type == 'search'
                      AND branches.isDeleted = 0`,
            async ({parentNoteId}) => {
                if (this.autoFix) {
                    const branches = await repository.getEntities(`SELECT *
                                                                   FROM branches
                                                                   WHERE isDeleted = 0
                                                                     AND parentNoteId = ?`, [parentNoteId]);

                    for (const branch of branches) {
                        branch.parentNoteId = 'root';
                        await branch.save();

                        logFix(`Child branch ${branch.branchId} has been moved to root since it was a child of a search note ${parentNoteId}`)
                    }
                } else {
                    logError(`Search note ${parentNoteId} has children`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId
                    FROM attributes
                    WHERE isDeleted = 0
                      AND type = 'relation'
                      AND value = ''`,
            async ({attributeId}) => {
                if (this.autoFix) {
                    const relation = await repository.getAttribute(attributeId);
                    relation.isDeleted = true;
                    await relation.save();

                    logFix(`Removed relation ${relation.attributeId} of name "${relation.name} with empty target.`);
                } else {
                    logError(`Relation ${attributeId} has empty target.`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId,
                           type
                    FROM attributes
                    WHERE isDeleted = 0
                      AND type != 'label'
                      AND type != 'label-definition'
                      AND type != 'relation'
                      AND type != 'relation-definition'`,
            async ({attributeId, type}) => {
                if (this.autoFix) {
                    const attribute = await repository.getAttribute(attributeId);
                    attribute.type = 'label';
                    await attribute.save();

                    logFix(`Attribute ${attributeId} type was changed to label since it had invalid type '${type}'`);
                } else {
                    logError(`Attribute ${attributeId} has invalid type '${type}'`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId,
                           attributes.noteId
                    FROM attributes
                             JOIN notes ON attributes.noteId = notes.noteId
                    WHERE attributes.isDeleted = 0
                      AND notes.isDeleted = 1`,
            async ({attributeId, noteId}) => {
                if (this.autoFix) {
                    const attribute = await repository.getAttribute(attributeId);
                    attribute.isDeleted = true;
                    await attribute.save();

                    logFix(`Removed attribute ${attributeId} because owning note ${noteId} is also deleted.`);
                } else {
                    logError(`Attribute ${attributeId} is not deleted even though owning note ${noteId} is deleted.`);
                }
            });

        await this.findAndFixIssues(`
                    SELECT attributeId,
                           attributes.value AS targetNoteId
                    FROM attributes
                             JOIN notes ON attributes.value = notes.noteId
                    WHERE attributes.type = 'relation'
                      AND attributes.isDeleted = 0
                      AND notes.isDeleted = 1`,
            async ({attributeId, targetNoteId}) => {
                if (this.autoFix) {
                    const attribute = await repository.getAttribute(attributeId);
                    attribute.isDeleted = true;
                    await attribute.save();

                    logFix(`Removed attribute ${attributeId} because target note ${targetNoteId} is also deleted.`);
                } else {
                    logError(`Attribute ${attributeId} is not deleted even though target note ${targetNoteId} is deleted.`);
                }
            });
    }

    async runSyncRowChecks(entityName, key) {
        await this.findAndFixIssues(`
        SELECT 
          ${key} as entityId
        FROM 
          ${entityName} 
          LEFT JOIN sync ON sync.entityName = '${entityName}' AND entityId = ${key} 
        WHERE 
          sync.id IS NULL AND ` + (entityName === 'options' ? 'options.isSynced = 1' : '1'),
            async ({entityId}) => {
                if (this.autoFix) {
                    await syncTableService.addEntitySync(entityName, entityId);

                    logFix(`Created missing sync record for entityName=${entityName}, entityId=${entityId}`);
                } else {
                    logError(`Missing sync record for entityName=${entityName}, entityId=${entityId}`);
                }
            });

        await this.findAndFixIssues(`
            SELECT 
              id, entityId
            FROM 
              sync 
              LEFT JOIN ${entityName} ON entityId = ${key} 
            WHERE 
              sync.entityName = '${entityName}' 
              AND ${key} IS NULL`,
                async ({id, entityId}) => {
                    if (this.autoFix) {
                        await sql.execute("DELETE FROM sync WHERE entityName = ? AND entityId = ?", [entityName, entityId]);

                        logFix(`Deleted extra sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
                    } else {
                        logError(`Unrecognized sync record id=${id}, entityName=${entityName}, entityId=${entityId}`);
                    }
                });
    }

    async findSyncRowsIssues() {
        await this.runSyncRowChecks("notes", "noteId");
        await this.runSyncRowChecks("note_contents", "noteId");
        await this.runSyncRowChecks("note_revisions", "noteRevisionId");
        await this.runSyncRowChecks("branches", "branchId");
        await this.runSyncRowChecks("recent_notes", "noteId");
        await this.runSyncRowChecks("attributes", "attributeId");
        await this.runSyncRowChecks("api_tokens", "apiTokenId");
        await this.runSyncRowChecks("options", "name");
    }

    async runAllChecks() {
        this.unrecoveredConsistencyErrors = false;
        this.fixedIssues = false;

        await this.findBrokenReferenceIssues();

        await this.findExistencyIssues();

        await this.findLogicIssues();

        await this.findSyncRowsIssues();

        // root branch should always be expanded
        await sql.execute("UPDATE branches SET isExpanded = 1 WHERE branchId = 'root'");

        if (this.unrecoveredConsistencyErrors) {
            // we run this only if basic checks passed since this assumes basic data consistency

            await this.checkTreeCycles();
        }

        return !this.unrecoveredConsistencyErrors;
    }

    async showEntityStat(name, query) {
        const map = await sql.getMap(query);

        map[0] = map[0] || 0;
        map[1] = map[1] || 0;

        log.info(`${name} deleted: ${map[1]}, not deleted ${map[0]}`);
    }

    async runDbDiagnostics() {
        await this.showEntityStat("Notes", `SELECT isDeleted, count(1)
                                       FROM notes
                                       GROUP BY isDeleted`);
        await this.showEntityStat("Note revisions", `SELECT isErased, count(1)
                                                FROM note_revisions
                                                GROUP BY isErased`);
        await this.showEntityStat("Branches", `SELECT isDeleted, count(1)
                                          FROM branches
                                          GROUP BY isDeleted`);
        await this.showEntityStat("Attributes", `SELECT isDeleted, count(1)
                                            FROM attributes
                                            GROUP BY isDeleted`);
        await this.showEntityStat("API tokens", `SELECT isDeleted, count(1)
                                            FROM api_tokens
                                            GROUP BY isDeleted`);
    }

    async runChecks() {
        let elapsedTimeMs;

        await syncMutexService.doExclusively(async () => {
            const startTime = new Date();

            await this.runDbDiagnostics();

            await this.runAllChecks();

            elapsedTimeMs = Date.now() - startTime.getTime();
        });

        if (this.unrecoveredConsistencyErrors) {
            log.info(`Consistency checks failed (took ${elapsedTimeMs}ms)`);

            ws.sendMessageToAllClients({type: 'consistency-checks-failed'});
        } else {
            log.info(`All consistency checks passed (took ${elapsedTimeMs}ms)`);
        }
    }
}

function logFix(message) {
    log.info("Consistency issue fixed: " + message);
}

function logError(message) {
    log.info("Consistency error: " + message);
}

async function runPeriodicChecks() {
    const autoFix = await optionsService.getOptionBool('autoFixConsistencyIssues');
    
    const consistencyChecks = new ConsistencyChecks(autoFix);
    await consistencyChecks.runChecks();
}

async function runOnDemandChecks(autoFix) {
    const consistencyChecks = new ConsistencyChecks(autoFix);
    await consistencyChecks.runChecks();
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(runPeriodicChecks), 60 * 60 * 1000);

    // kickoff checks soon after startup (to not block the initial load)
    setTimeout(cls.wrap(runPeriodicChecks), 20 * 1000);
});

module.exports = {
    runOnDemandChecks
};