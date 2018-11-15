"use strict";

const noteService = require('../../services/notes');
const protectedSessionService = require('../../services/protected_session');
const repository = require('../../services/repository');

async function uploadFile(req) {
    const parentNoteId = req.params.parentNoteId;
    const file = req.file;
    const originalName = file.originalname;
    const size = file.size;
    const mime = file.mimetype.toLowerCase();

    const parentNote = await repository.getNote(parentNoteId);

    if (!parentNote) {
        return [404, `Note ${parentNoteId} doesn't exist.`];
    }

    const {note} = await noteService.createNote(parentNoteId, originalName, file.buffer, {
        target: 'into',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        type: mime.startsWith("image/") ? 'image' : 'file',
        mime: file.mimetype,
        attributes: [
            { type: "label", name: "originalFileName", value: originalName },
            { type: "label", name: "fileSize", value: size }
        ]
    });

    return {
        noteId: note.noteId
    };
}

async function downloadFile(req, res) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        res.status(401).send("Protected session not available");
        return;
    }

    const originalFileName = await note.getLabel('originalFileName');
    const fileName = originalFileName ? originalFileName.value : note.title;

    res.setHeader('Content-Disposition', 'file; filename="' + fileName + '"');
    res.setHeader('Content-Type', note.mime);

    res.send(note.content);
}

module.exports = {
    uploadFile,
    downloadFile
};