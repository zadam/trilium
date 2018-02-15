"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const notes = require('../../services/notes');
const multer = require('multer')();
const wrap = require('express-promise-wrap').wrap;

router.post('/upload/:parentNoteId', auth.checkApiAuthOrElectron, multer.single('upload'), wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

    if (!note) {
        return res.status(404).send(`Note ${parentNoteId} doesn't exist.`);
    }

    const noteId = (await notes.createNewNote(parentNoteId, {
        title: "attachment",
        content: file.buffer,
        target: 'into',
        isProtected: false,
        type: 'file',
        mime: ''
    })).noteId;

    res.send({
        noteId: noteId
    });
}));

module.exports = router;