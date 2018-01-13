"use strict";

const sql = require('./sql');

async function validateParentChild(res, parentNoteId, childNoteId, noteTreeId = null) {
    const existing = await getExistingNoteTree(parentNoteId, childNoteId);

    if (existing && (noteTreeId === null || existing.note_tree_id !== noteTreeId)) {
        res.send({
            success: false,
            message: 'This note already exists in the target.'
        });

        return false;
    }

    if (!await checkTreeCycle(parentNoteId, childNoteId)) {
        res.send({
            success: false,
            message: 'Moving note here would create cycle.'
        });

        return false;
    }

    return true;
}

async function getExistingNoteTree(parentNoteId, childNoteId) {
    return await sql.getFirst('SELECT * FROM notes_tree WHERE note_id = ? AND parent_note_id = ? AND is_deleted = 0', [childNoteId, parentNoteId]);
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

        const parentNoteIds = await sql.getFirstColumn("SELECT DISTINCT parent_note_id FROM notes_tree WHERE note_id = ? AND is_deleted = 0", [parentNoteId]);

        for (const pid of parentNoteIds) {
            if (!await checkTreeCycleInner(pid)) {
                return false;
            }
        }

        return true;
    }

    return await checkTreeCycleInner(parentNoteId);
}

async function getNoteTree(noteTreeId) {
    return sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);
}

async function loadSubTreeNoteIds(parentNoteId, subTreeNoteIds) {
    subTreeNoteIds.push(parentNoteId);

    const children = await sql.getFirstColumn("SELECT note_id FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubTreeNoteIds(childNoteId, subTreeNoteIds);
    }
}

module.exports = {
    validateParentChild,
    getNoteTree
};