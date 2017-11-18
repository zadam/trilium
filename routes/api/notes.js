"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const notes = require('../../services/notes');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');
const RequestContext = require('../../services/request_context');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;

    const detail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    if (detail.is_protected) {
        const dataKey = protected_session.getDataKey(req);

        detail.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(detail.note_id), detail.note_title);
        detail.note_text = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(detail.note_id), detail.note_text);
    }

    res.send({
        detail: detail,
        images: await sql.getResults("select * from images where note_id = ? order by note_offset", [detail.note_id]),
        loadTime: utils.nowTimestamp()
    });
});

router.post('/:parentNoteTreeId/children', async (req, res, next) => {
    const parentNoteTreeId = req.params.parentNoteTreeId;
    const browserId = utils.browserId(req);
    const note = req.body;

    const { noteId, noteTreeId } = await notes.createNewNote(parentNoteTreeId, note, browserId);

    res.send({
        'note_id': noteId,
        'note_tree_id': noteTreeId
    });
});

router.put('/:noteId', async (req, res, next) => {
    const note = req.body;
    const noteId = req.params.noteId;
    const reqCtx = new RequestContext(req);

    await notes.updateNote(noteId, note, reqCtx);

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