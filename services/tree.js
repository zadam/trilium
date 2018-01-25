"use strict";

const sql = require('./sql');
const sync_table = require('./sync_table');
const data_encryption = require('./data_encryption');

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

async function sortNotesAlphabetically(parentNoteId, req, sourceId) {
    await sql.doInTransaction(async () => {
        const notes = await sql.getAll(`SELECT note_tree_id, note_id, note_title, is_protected 
                                       FROM notes JOIN notes_tree USING(note_id) 
                                       WHERE notes_tree.is_deleted = 0 AND parent_note_id = ?`, [parentNoteId]);

        protected_session.decryptNotes(req, notes);

        notes.sort((a, b) => a.note_title.toLowerCase() < b.note_title.toLowerCase() ? -1 : 1);

        let position = 1;

        for (const note of notes) {
            await sql.execute("UPDATE notes_tree SET note_position = ? WHERE note_tree_id = ?",
                [position, note.note_tree_id]);

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