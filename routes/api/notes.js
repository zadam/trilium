"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const log = require('../../services/log');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');
const sync_table = require('../../services/sync_table');
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

router.delete('/:noteTreeId', auth.checkApiAuth, wrap(async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await notes.deleteNote(req.params.noteTreeId, req.headers.source_id);
    });

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

    await sql.doInTransaction(async () => {
       const notes = await sql.getAll(`SELECT note_tree_id, note_id, note_title, is_protected 
                                       FROM notes JOIN notes_tree USING(note_id) WHERE parent_note_id = ?`, [noteId]);

       for (const note of notes) {
           if (note.is_protected) {
               note.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
           }
       }

       notes.sort((a, b) => a.note_title.toLowerCase() < b.note_title.toLowerCase() ? -1 : 1);

       let position = 1;

       for (const note of notes) {
           await sql.execute("UPDATE notes_tree SET note_position = ? WHERE note_tree_id = ?",
               [position, note.note_tree_id]);

           position++;
       }

       await sync_table.addNoteReorderingSync(noteId, sourceId);
    });

    res.send({});
}));

module.exports = router;