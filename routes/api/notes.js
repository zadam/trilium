"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const notes = require('../../services/notes');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    let noteId = req.params.noteId;

    await options.setOption('start_node', noteId);

    let detail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    if (detail.note_clone_id) {
        noteId = detail.note_clone_id;
        detail = sql.getSingleResult("select * from notes where note_id = ?", [noteId]);
    }

    if (detail.encryption > 0) {
        const dataKey = protected_session.getDataKey(req);

        detail.note_title = data_encryption.decrypt(dataKey, detail.note_title);
        detail.note_text = data_encryption.decrypt(dataKey, detail.note_text);
    }

    res.send({
        detail: detail,
        images: await sql.getResults("select * from images where note_id = ? order by note_offset", [noteId]),
        loadTime: utils.nowTimestamp()
    });
});

router.post('/:parentNoteId/children', async (req, res, next) => {
    let parentNoteId = req.params.parentNoteId;
    const browserId = utils.browserId(req);
    const note = req.body;

    const noteId = await notes.createNewNote(parentNoteId, note, browserId);

    res.send({
        'note_id': noteId
    });
});

router.put('/:noteId', async (req, res, next) => {
    const newNote = req.body;
    let noteId = req.params.noteId;
    const browserId = utils.browserId(req);

    await notes.updateNote(noteId, newNote, browserId);

    res.send({});
});

router.delete('/:noteId', async (req, res, next) => {
    const browserId = utils.browserId(req);

    await sql.doInTransaction(async () => {
        await notes.deleteNote(req.params.noteId, browserId);
    });

    res.send({});
});

router.get('/', async (req, res, next) => {
    const search = '%' + req.query.search + '%';

    const result = await sql.getResults("select note_id from notes where note_title like ? or note_text like ?", [search, search]);

    const noteIdList = [];

    for (const res of result) {
        noteIdList.push(res.note_id);
    }

    res.send(noteIdList);
});

module.exports = router;