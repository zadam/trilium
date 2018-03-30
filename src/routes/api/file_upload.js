"use strict";

const sql = require('../../services/sql');
const notes = require('../../services/notes');
const labels = require('../../services/labels');
const protected_session = require('../../services/protected_session');

async function uploadFile(req) {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;
    const originalName = file.originalname;
    const size = file.size;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

    if (!note) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const {noteId} = await notes.createNewNote(parentNoteId, {
        title: originalName,
        content: file.buffer,
        target: 'into',
        isProtected: false,
        type: 'file',
        mime: file.mimetype
    }, req, sourceId);

    await labels.createLabel(noteId, "original_file_name", originalName, sourceId);
    await labels.createLabel(noteId, "file_size", size, sourceId);

    return {
        noteId: noteId
    };
}

async function downloadFile(req, res) {
    const noteId = req.params.noteId;
    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);
    const protectedSessionId = req.query.protectedSessionId;

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (note.isProtected) {
        const dataKey = protected_session.getDataKeyForProtectedSessionId(protectedSessionId);

        if (!dataKey) {
            res.status(401).send("Protected session not available");
            return;
        }

        protected_session.decryptNote(dataKey, note);
    }

    const labelMap = await labels.getNoteLabelMap(noteId);
    const fileName = labelMap.original_file_name ? labelMap.original_file_name : note.title;

    res.setHeader('Content-Disposition', 'file; filename=' + fileName);
    res.setHeader('Content-Type', note.mime);

    res.send(note.content);
}

module.exports = {
    uploadFile,
    downloadFile
};