"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const auth = require('../../services/auth');
const sync_table = require('../../services/sync_table');

router.put('/:noteTreeId/move-to/:parentNoteId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const parentNoteId = req.params.parentNoteId;
    const sourceId = req.headers.source_id;

    const noteToMove = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);

    if (!await validateParentChild(res, parentNoteId, noteToMove.note_id, noteTreeId)) {
        return;
    }

    const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [parentNoteId, newNotePos, now, noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
});

router.put('/:noteTreeId/move-before/:beforeNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const beforeNoteTreeId = req.params.beforeNoteTreeId;
    const sourceId = req.headers.source_id;

    const noteToMove = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);
    const beforeNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [beforeNoteTreeId]);

    if (!await validateParentChild(res, beforeNote.parent_note_id, noteToMove.note_id, noteTreeId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position >= ? AND is_deleted = 0",
            [beforeNote.parent_note_id, beforeNote.note_position]);

        await sync_table.addNoteReorderingSync(beforeNote.parent_note_id, sourceId);

        const now = utils.nowDate();

        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [beforeNote.parent_note_id, beforeNote.note_position, now, noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
});

router.put('/:noteTreeId/move-after/:afterNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const noteToMove = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);
    const afterNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [afterNoteTreeId]);

    if (!await validateParentChild(res, afterNote.parent_note_id, noteToMove.note_id, noteTreeId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position > ? AND is_deleted = 0",
            [afterNote.parent_note_id, afterNote.note_position]);

        await sync_table.addNoteReorderingSync(afterNote.parent_note_id, sourceId);

        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [afterNote.parent_note_id, afterNote.note_position + 1, utils.nowDate(), noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({ success: true });
});

router.put('/:childNoteId/clone-to/:parentNoteId', auth.checkApiAuth, async (req, res, next) => {
    const parentNoteId = req.params.parentNoteId;
    const childNoteId = req.params.childNoteId;
    const prefix = req.body.prefix;
    const sourceId = req.headers.source_id;

    if (!await validateParentChild(res, parentNoteId, childNoteId)) {
        return;
    }

    const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    await sql.doInTransaction(async () => {
        const noteTree = {
            note_tree_id: utils.newNoteTreeId(),
            note_id: childNoteId,
            parent_note_id: parentNoteId,
            prefix: prefix,
            note_position: newNotePos,
            is_expanded: 0,
            date_modified: utils.nowDate(),
            is_deleted: 0
        };

        await sql.replace("notes_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.note_tree_id, sourceId);

        await sql.execute("UPDATE notes_tree SET is_expanded = 1 WHERE note_id = ?", [parentNoteId]);
    });

    res.send({ success: true });
});

router.put('/:noteId/clone-after/:afterNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const afterNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [afterNoteTreeId]);

    if (!await validateParentChild(res, afterNote.parent_note_id, noteId)) {
        return;
    }

    await sql.doInTransaction(async () => {
        // we don't change date_modified so other changes are prioritized in case of conflict
        // also we would have to sync all those modified note trees otherwise hash checks would fail
        await sql.execute("UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position > ? AND is_deleted = 0",
            [afterNote.parent_note_id, afterNote.note_position]);

        await sync_table.addNoteReorderingSync(afterNote.parent_note_id, sourceId);

        const noteTree = {
            note_tree_id: utils.newNoteTreeId(),
            note_id: noteId,
            parent_note_id: afterNote.parent_note_id,
            note_position: afterNote.note_position + 1,
            is_expanded: 0,
            date_modified: utils.nowDate(),
            is_deleted: 0
        };

        await sql.replace("notes_tree", noteTree);

        await sync_table.addNoteTreeSync(noteTree.note_tree_id, sourceId);
    });

    res.send({ success: true });
});

async function loadSubTreeNoteIds(parentNoteId, subTreeNoteIds) {
    subTreeNoteIds.push(parentNoteId);

    const children = await sql.getFirstColumn("SELECT note_id FROM notes_tree WHERE parent_note_id = ?", [parentNoteId]);

    for (const childNoteId of children) {
        await loadSubTreeNoteIds(childNoteId, subTreeNoteIds);
    }
}

async function validateParentChild(res, parentNoteId, childNoteId, noteTreeId = null) {
    const existing = await getExistingNoteTree(parentNoteId, childNoteId);

    if (existing && (noteTreeId === null || existing.note_tree_id !== noteTreeId)) {
        res.send({
            success: false,
            message: 'This note already exists in target parent note.'
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

        const parentNoteIds = await sql.getFirstColumn("SELECT DISTINCT parent_note_id FROM notes_tree WHERE note_id = ?", [parentNoteId]);

        for (const pid of parentNoteIds) {
            if (!await checkTreeCycleInner(pid)) {
                return false;
            }
        }

        return true;
    }

    return await checkTreeCycleInner(parentNoteId);
}

router.put('/:noteTreeId/expanded/:expanded', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const expanded = req.params.expanded;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET is_expanded = ? WHERE note_tree_id = ?", [expanded, noteTreeId]);

        // we don't sync expanded attribute
    });

    res.send({});
});

module.exports = router;