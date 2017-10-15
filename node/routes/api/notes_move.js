const express = require('express');
const router = express.Router();
const sql = require('../../sql');
const utils = require('../../utils');
const audit_category = require('../../audit_category');
const auth = require('../../auth');

router.put('/:noteId/moveTo/:parentId', auth.checkApiAuth, async (req, res, next) => {
    let noteId = req.params.noteId;
    let parentId = req.params.parentId;

    const row = await sql.getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ?', [parentId]);
    const maxNotePos = row['max_note_pos'];
    let newNotePos = 0;

    if (maxNotePos === null)  // no children yet
        newNotePos = 0;
    else
        newNotePos = maxNotePos + 1;

    await sql.beginTransaction();

    await sql.execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [parentId, newNotePos, noteId]);

    await sql.addAudit(audit_category.CHANGE_PARENT, req, noteId);

    await sql.commit();

    res.send({});
});

router.put('/:noteId/moveBefore/:beforeNoteId', async (req, res, next) => {
    let noteId = req.params.noteId;
    let beforeNoteId = req.params.beforeNoteId;

    const beforeNote = await sql.getSingleResult("select * from notes_tree where note_id = ?", [beforeNoteId]);

    if (beforeNote !== null) {
        await sql.beginTransaction();

        await sql.execute("update notes_tree set note_pos = note_pos + 1 where note_id = ?", [beforeNoteId]);

        await sql.execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [beforeNote['note_pid'], beforeNote['note_pos'], noteId]);

        await sql.addAudit(audit_category.CHANGE_POSITION, req, noteId);

        await sql.commit();
    }

    res.send({});
});

router.put('/:noteId/moveAfter/:afterNoteId', async (req, res, next) => {
    let noteId = req.params.noteId;
    let afterNoteId = req.params.afterNoteId;

    const afterNote = await sql.getSingleResult("select * from notes_tree where note_id = ?", [afterNoteId]);

    if (afterNote !== null) {
        await sql.beginTransaction();

        await sql.execute("update notes_tree set note_pos = note_pos + 1 where note_pid = ? and note_pos > ?", [afterNote['note_pid'], afterNote['note_pos']]);

        await sql.execute("update notes_tree set note_pid = ?, note_pos = ? where note_id = ?", [afterNote['note_pid'], afterNote['note_pos'] + 1, noteId]);

        await sql.addAudit(audit_category.CHANGE_POSITION, req, noteId);

        await sql.commit();
    }

    res.send({});
});

router.put('/:noteId/expanded/:expanded', async (req, res, next) => {
    let noteId = req.params.noteId;
    let expanded = req.params.expanded;

    await sql.execute("update notes_tree set is_expanded = ? where note_id = ?", [expanded, noteId]);

    // no audit here, not really important

    res.send({});
});

module.exports = router;