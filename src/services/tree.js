"use strict";

const sql = require('./sql');
const repository = require('./repository');
const Branch = require('../entities/branch');
const syncTableService = require('./sync_table');
const protectedSessionService = require('./protected_session');
const noteCacheService = require('./note_cache');

async function getNotes(noteIds) {
    // we return also deleted notes which have been specifically asked for
    const notes = await sql.getManyRows(`
        SELECT 
          noteId,
          title,
          contentLength,
          isProtected,
          type,
          mime,
          isDeleted
        FROM notes
        WHERE noteId IN (???)`, noteIds);

    protectedSessionService.decryptNotes(notes);

    await noteCacheService.loadedPromise;

    notes.forEach(note => {
        note.isProtected = !!note.isProtected
    });

    return notes;
}

async function validateParentChild(parentNoteId, childNoteId, branchId = null) {
    if (childNoteId === 'root') {
        return { success: false, message: 'Cannot move root note.'};
    }

    if (parentNoteId === 'none') {
        // this shouldn't happen
        return { success: false, message: 'Cannot move anything into root parent.' };
    }

    const existing = await getExistingBranch(parentNoteId, childNoteId);

    if (existing && (branchId === null || existing.branchId !== branchId)) {
        return {
            success: false,
            message: 'This note already exists in the target.'
        };
    }

    if (!await checkTreeCycle(parentNoteId, childNoteId)) {
        return {
            success: false,
            message: 'Moving/cloning note here would create cycle.'
        };
    }

    return { success: true };
}

async function getExistingBranch(parentNoteId, childNoteId) {
    return await repository.getEntity('SELECT * FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0', [childNoteId, parentNoteId]);
}

/**
 * Tree cycle can be created when cloning or when moving existing clone. This method should detect both cases.
 */
async function checkTreeCycle(parentNoteId, childNoteId) {
    const subtreeNoteIds = [];

    // we'll load the whole sub tree - because the cycle can start in one of the notes in the sub tree
    await loadSubtreeNoteIds(childNoteId, subtreeNoteIds);

    async function checkTreeCycleInner(parentNoteId) {
        if (parentNoteId === 'root') {
            return true;
        }

        if (subtreeNoteIds.includes(parentNoteId)) {
            // while towards the root of the tree we encountered noteId which is already present in the subtree
            // joining parentNoteId with childNoteId would then clearly create a cycle
            return false;
        }

        const parentNoteIds = await sql.getColumn("SELECT DISTINCT parentNoteId FROM branches WHERE noteId = ? AND isDeleted = 0", [parentNoteId]);

        for (const pid of parentNoteIds) {
            if (!await checkTreeCycleInner(pid)) {
                return false;
            }
        }

        return true;
    }

    return await checkTreeCycleInner(parentNoteId);
}

async function loadSubtreeNoteIds(parentNoteId, subtreeNoteIds) {
    subtreeNoteIds.push(parentNoteId);

    const children = await sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubtreeNoteIds(childNoteId, subtreeNoteIds);
    }
}

async function sortNotesAlphabetically(parentNoteId, directoriesFirst = false) {
    await sql.transactional(async () => {
        const notes = await sql.getRows(
            `SELECT branches.branchId, notes.noteId, title, isProtected, 
                          CASE WHEN COUNT(childBranches.noteId) > 0 THEN 1 ELSE 0 END AS hasChildren 
                   FROM notes 
                   JOIN branches ON branches.noteId = notes.noteId
                   LEFT JOIN branches childBranches ON childBranches.parentNoteId = notes.noteId AND childBranches.isDeleted = 0
                   WHERE branches.isDeleted = 0 AND branches.parentNoteId = ?
                   GROUP BY notes.noteId`, [parentNoteId]);

        protectedSessionService.decryptNotes(notes);

        notes.sort((a, b) => {
            if (directoriesFirst && ((a.hasChildren && !b.hasChildren) || (!a.hasChildren && b.hasChildren))) {
                // exactly one note of the two is a directory so the sorting will be done based on this status
                return a.hasChildren ? -1 : 1;
            }
            else {
                return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
            }
        });

        let position = 10;

        for (const note of notes) {
            await sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?",
                [position, note.branchId]);

            position += 10;
        }

        await syncTableService.addNoteReorderingSync(parentNoteId);
    });
}

/**
 * @deprecated - this will be removed in the future
 */
async function setNoteToParent(noteId, prefix, parentNoteId) {
    const parentNote = await repository.getNote(parentNoteId);

    if (parentNote && parentNote.isDeleted) {
        throw new Error(`Cannot move note to deleted parent note ${parentNoteId}`);
    }

    // case where there might be more such branches is ignored. It's expected there should be just one
    const branch = await repository.getEntity("SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ? AND prefix = ?", [noteId, prefix]);

    if (branch) {
        if (!parentNoteId) {
            branch.isDeleted = true;
        }
        else {
            branch.parentNoteId = parentNoteId;
            branch.prefix = prefix;
        }

        await branch.save();
    }
    else if (parentNoteId) {
        const note = await repository.getNote(noteId);

        if (note.isDeleted) {
            throw new Error(`Cannot create a branch for ${noteId} which is deleted.`);
        }

        const branch = await repository.getEntity('SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ? AND parentNoteId = ?', [noteId, parentNoteId]);

        if (branch) {
            branch.prefix = prefix;
            await branch.save();
        }
        else {
            await new Branch({
                noteId: noteId,
                parentNoteId: parentNoteId,
                prefix: prefix
            }).save();
        }
    }
}

module.exports = {
    getNotes,
    validateParentChild,
    sortNotesAlphabetically,
    setNoteToParent
};