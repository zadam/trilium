"use strict";

const sql = require('./sql');
const repository = require('./repository');
const Branch = require('../entities/branch');
const syncTableService = require('./sync_table');
const protectedSessionService = require('./protected_session');

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
    return await sql.getRow('SELECT * FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0', [childNoteId, parentNoteId]);
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

async function getBranch(branchId) {
    return sql.getRow("SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

async function loadSubtreeNoteIds(parentNoteId, subtreeNoteIds) {
    subtreeNoteIds.push(parentNoteId);

    const children = await sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubtreeNoteIds(childNoteId, subtreeNoteIds);
    }
}

async function sortNotesAlphabetically(parentNoteId) {
    await sql.transactional(async () => {
        const notes = await sql.getRows(`SELECT branchId, noteId, title, isProtected 
                                       FROM notes JOIN branches USING(noteId) 
                                       WHERE branches.isDeleted = 0 AND parentNoteId = ?`, [parentNoteId]);

        protectedSessionService.decryptNotes(notes);

        notes.sort((a, b) => a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1);

        let position = 1;

        for (const note of notes) {
            await sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?",
                [position, note.branchId]);

            position++;
        }

        await syncTableService.addNoteReorderingSync(parentNoteId);
    });
}

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

        await new Branch({
            noteId: noteId,
            parentNoteId: parentNoteId,
            prefix: prefix
        }).save();
    }
}

module.exports = {
    validateParentChild,
    getBranch,
    sortNotesAlphabetically,
    setNoteToParent
};