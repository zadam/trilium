"use strict";

const sql = require('./sql');
const sync_table = require('./sync_table');

async function validateParentChild(res, parentNoteId, childNoteId, noteTreeId = null) {
    const existing = await getExistingNoteTree(parentNoteId, childNoteId);

    if (existing && (noteTreeId === null || existing.noteTreeId !== noteTreeId)) {
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
    return await sql.getFirst('SELECT * FROM note_tree WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0', [childNoteId, parentNoteId]);
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

        const parentNoteIds = await sql.getFirstColumn("SELECT DISTINCT parentNoteId FROM note_tree WHERE noteId = ? AND isDeleted = 0", [parentNoteId]);

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
    return sql.getFirst("SELECT * FROM note_tree WHERE noteTreeId = ?", [noteTreeId]);
}

async function loadSubTreeNoteIds(parentNoteId, subTreeNoteIds) {
    subTreeNoteIds.push(parentNoteId);

    const children = await sql.getFirstColumn("SELECT noteId FROM note_tree WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubTreeNoteIds(childNoteId, subTreeNoteIds);
    }
}

async function sortNotesAlphabetically(parentNoteId, req, sourceId) {
    await sql.doInTransaction(async () => {
        const notes = await sql.getAll(`SELECT noteTreeId, noteId, title, isProtected 
                                       FROM notes JOIN note_tree USING(noteId) 
                                       WHERE note_tree.isDeleted = 0 AND parentNoteId = ?`, [parentNoteId]);

        protected_session.decryptNotes(req, notes);

        notes.sort((a, b) => a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1);

        let position = 1;

        for (const note of notes) {
            await sql.execute("UPDATE note_tree SET notePosition = ? WHERE noteTreeId = ?",
                [position, note.noteTreeId]);

            position++;
        }

        await sync_table.addNoteReorderingSync(parentNoteId, sourceId);
    });
}

module.exports = {
    validateParentChild,
    getNoteTree,
    sortNotesAlphabetically
};