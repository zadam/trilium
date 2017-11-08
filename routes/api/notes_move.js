"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const audit_category = require('../../services/audit_category');
const auth = require('../../services/auth');

router.put('/:noteId/moveTo/:parentId', auth.checkApiAuth, async (req, res, next) => {
    let noteId = req.params.noteId;
    let parentId = req.params.parentId;

    const row = await sql.getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ? and is_deleted = 0', [parentId]);
    const maxNotePos = row['max_note_pos'];
    let newNotePos = 0;

    if (maxNotePos === null)  // no children yet
        newNotePos = 0;
    else
        newNotePos = maxNotePos + 1;

    const now = utils.nowTimestamp();

    await sql.doInTransaction(async () => {
        await sql.execute("update notes_tree set note_pid = ?, note_pos = ?, date_modified = ? where note_id = ?",
            [parentId, newNotePos, now, noteId]);

        await sql.addNoteTreeSync(noteId);
        await sql.addAudit(audit_category.CHANGE_PARENT, utils.browserId(req), noteId, null, parentId);
    });

    res.send({});
});

router.put('/:noteId/moveBefore/:beforeNoteId', async (req, res, next) => {
    let noteId = req.params.noteId;
    let beforeNoteId = req.params.beforeNoteId;

    const beforeNote = await sql.getSingleResult("select * from notes_tree where note_id = ?", [beforeNoteId]);

    if (beforeNote) {
        await sql.doInTransaction(async () => {
            // we don't change date_modified so other changes are prioritized in case of conflict
            await sql.execute("update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos >= ? and is_deleted = 0",
                [beforeNote['note_pid'], beforeNote['note_pos']]);

            await sql.execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?",
                [beforeNote['note_pid'], beforeNote['note_pos'], noteId]);

            await sql.addNoteTreeSync(noteId);
            await sql.addNoteReorderingSync(beforeNote['note_pid']);
            await sql.addAudit(audit_category.CHANGE_POSITION, utils.browserId(req), beforeNote['note_pid']);
        });
    }

    res.send({});
});

router.put('/:noteId/moveAfter/:afterNoteId', async (req, res, next) => {
    let noteId = req.params.noteId;
    let afterNoteId = req.params.afterNoteId;

    const afterNote = await sql.getSingleResult("select * from notes_tree where note_id = ?", [afterNoteId]);

    if (afterNote) {
        await sql.doInTransaction(async () => {
            // we don't change date_modified so other changes are prioritized in case of conflict
            await sql.execute("update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos > ? and is_deleted = 0",
                [afterNote['note_pid'], afterNote['note_pos']]);

            await sql.execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?",
                [afterNote['note_pid'], afterNote['note_pos'] + 1, noteId]);

            await sql.addNoteTreeSync(noteId);
            await sql.addNoteReorderingSync(afterNote['note_pid']);
            await sql.addAudit(audit_category.CHANGE_POSITION, utils.browserId(req), afterNote['note_pid']);
        });
    }

    res.send({});
});

router.put('/:noteId/expanded/:expanded', async (req, res, next) => {
    const noteId = req.params.noteId;
    const expanded = req.params.expanded;

    await sql.doInTransaction(async () => {
        await sql.execute("update notes_tree set is_expanded = ? where note_id = ?", [expanded, noteId]);
    });

    res.send({});
});

module.exports = router;