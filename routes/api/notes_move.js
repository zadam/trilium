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

    const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;

    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE notes_tree SET parent_note_id = ?, note_position = ?, date_modified = ? WHERE note_tree_id = ?",
            [parentNoteId, newNotePos, now, noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({});
});

router.put('/:noteTreeId/move-before/:beforeNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const beforeNoteTreeId = req.params.beforeNoteTreeId;
    const sourceId = req.headers.source_id;

    const beforeNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [beforeNoteTreeId]);

    if (beforeNote) {
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

        res.send({});
    }
    else {
        res.status(500).send("Before note " + beforeNoteTreeId + " doesn't exist.");
    }
});

router.put('/:noteTreeId/move-after/:afterNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const afterNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [afterNoteTreeId]);

    if (afterNote) {
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

        res.send({});
    }
    else {
        res.status(500).send("After note " + afterNoteTreeId + " doesn't exist.");
    }
});

router.put('/:childNoteId/clone-to/:parentNoteId', auth.checkApiAuth, async (req, res, next) => {
    const parentNoteId = req.params.parentNoteId;
    const childNoteId = req.params.childNoteId;
    const prefix = req.body.prefix;
    const sourceId = req.headers.source_id;

    const existing = await sql.getFirst('SELECT * FROM notes_tree WHERE note_id = ? AND parent_note_id = ?', [childNoteId, parentNoteId]);

    if (existing && !existing.is_deleted) {
        return res.send({
            success: false,
            message: 'This note already exists in target parent note.'
        });
    }

    if (!await checkCycle(parentNoteId, childNoteId)) {
        return res.send({
            success: false,
            message: 'Cloning note here would create cycle.'
        });
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

    res.send({
        success: true
    });
});

router.put('/:noteId/clone-after/:afterNoteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const afterNoteTreeId = req.params.afterNoteTreeId;
    const sourceId = req.headers.source_id;

    const afterNote = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [afterNoteTreeId]);

    if (!afterNote) {
        return res.status(500).send("After note " + afterNoteTreeId + " doesn't exist.");
    }

    if (!await checkCycle(afterNote.parent_note_id, noteId)) {
        return res.send({
            success: false,
            message: 'Cloning note here would create cycle.'
        });
    }

    const existing = await sql.getFirstValue('SELECT * FROM notes_tree WHERE note_id = ? AND parent_note_id = ?', [noteId, afterNote.parent_note_id]);

    if (existing && !existing.is_deleted) {
        return res.send({
            success: false,
            message: 'This note already exists in target parent note.'
        });
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

    res.send({
        success: true
    });
});

async function checkCycle(parentNoteId, childNoteId) {
    if (parentNoteId === 'root') {
        return true;
    }

    if (parentNoteId === childNoteId) {
        return false;
    }

    const parentNoteIds = await sql.getFirstColumn("SELECT DISTINCT parent_note_id FROM notes_tree WHERE note_id = ?", [parentNoteId]);

    for (const pid of parentNoteIds) {
        if (!await checkCycle(pid, childNoteId)) {
            return false;
        }
    }

    return true;
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