"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const log = require('../../services/log');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');
const tree = require('../../services/tree');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const detail = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    if (!detail) {
        log.info("Note " + noteId + " has not been found.");

        return res.status(404).send({});
    }

    if (detail.is_protected) {
        const dataKey = protected_session.getDataKey(req);

        detail.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(detail.note_id), detail.note_title);
        detail.note_text = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(detail.note_id), detail.note_text);
    }

    res.send({
        detail: detail
    });
}));

router.post('/:parentNoteId/children', auth.checkApiAuth, wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const note = req.body;

    const { noteId, noteTreeId } = await notes.createNewNote(parentNoteId, note, sourceId);

    res.send({
        'note_id': noteId,
        'note_tree_id': noteTreeId
    });
}));

router.put('/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const note = req.body;
    const noteId = req.params.noteId;
    const sourceId = req.headers.source_id;
    const dataKey = protected_session.getDataKey(req);

    await notes.updateNote(noteId, note, dataKey, sourceId);

    res.send({});
}));

router.get('/', auth.checkApiAuth, wrap(async (req, res, next) => {
    const search = '%' + req.query.search + '%';

    const result = await sql.getAll("SELECT note_id FROM notes WHERE note_title LIKE ? OR note_text LIKE ?", [search, search]);

    const noteIdList = [];

    for (const res of result) {
        noteIdList.push(res.note_id);
    }

    res.send(noteIdList);
}));

router.put('/:noteId/sort', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const sourceId = req.headers.source_id;
    const dataKey = protected_session.getDataKey(req);

    await tree.sortNotesAlphabetically(noteId, dataKey, sourceId);

    res.send({});
}));

router.put('/:noteId/protect-sub-tree/:isProtected', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const isProtected = !!parseInt(req.params.isProtected);
    const dataKey = protected_session.getDataKey(req);
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await notes.protectNoteRecursively(noteId, dataKey, isProtected, sourceId);
    });

    res.send({});
}));

module.exports = router;