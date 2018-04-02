"use strict";

const sql = require('./sql');
const syncTableService = require('./sync_table');
const protectedSessionService = require('./protected_session');

async function validateParentChild(parentNoteId, childNoteId, branchId = null) {
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
            message: 'Moving note here would create cycle.'
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
    const subTreeNoteIds = [];

    // we'll load the whole sub tree - because the cycle can start in one of the notes in the sub tree
    await loadSubTreeNoteIds(childNoteId, subTreeNoteIds);

    async function checkTreeCycleInner(parentNoteId) {
        if (parentNoteId === 'root') {
            return true;
        }

        if (subTreeNoteIds.includes(parentNoteId)) {
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

async function loadSubTreeNoteIds(parentNoteId, subTreeNoteIds) {
    subTreeNoteIds.push(parentNoteId);

    const children = await sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubTreeNoteIds(childNoteId, subTreeNoteIds);
    }
}

async function sortNotesAlphabetically(parentNoteId) {
    await sql.doInTransaction(async () => {
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

module.exports = {
    validateParentChild,
    getBranch,
    sortNotesAlphabetically
};