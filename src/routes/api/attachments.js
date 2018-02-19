"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const notes = require('../../services/notes');
const attributes = require('../../services/attributes');
const multer = require('multer')();
const wrap = require('express-promise-wrap').wrap;

router.post('/upload/:parentNoteId', auth.checkApiAuthOrElectron, multer.single('upload'), wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;
    const originalName = file.originalname;
    const size = file.size;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

    if (!note) {
        return res.status(404).send(`Note ${parentNoteId} doesn't exist.`);
    }

    await sql.doInTransaction(async () => {
        const noteId = (await notes.createNewNote(parentNoteId, {
            title: originalName,
            content: file.buffer,
            target: 'into',
            isProtected: false,
            type: 'file',
            mime: file.mimetype
        }, req, sourceId)).noteId;

        await attributes.createAttribute(noteId, "original_file_name", originalName);
        await attributes.createAttribute(noteId, "file_size", size);

        res.send({
            noteId: noteId
        });
    });
}));

router.get('/download/:noteId', auth.checkApiAuthOrElectron, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!note) {
        return res.status(404).send(`Note ${parentNoteId} doesn't exist.`);
    }

    const attributeMap = await attributes.getNoteAttributeMap(noteId);
    const fileName = attributeMap.original_file_name ? attributeMap.original_file_name : note.title;

    res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
    res.setHeader('Content-Type', note.mime);

    res.send(note.content);
}));

module.exports = router;