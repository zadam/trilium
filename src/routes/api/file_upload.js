"use strict";

const noteService = require('../../services/notes');
const protectedSessionService = require('../../services/protected_session');
const repository = require('../../services/repository');
const utils = require('../../services/utils');

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

async function downloadNoteFile(noteId, res) {
    const note = await repository.getNote(noteId);

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    const originalFileName = await note.getLabel('originalFileName');
    const fileName = originalFileName ? originalFileName.value : note.title;

    res.setHeader('Content-Disposition', utils.getContentDisposition(fileName));
    res.setHeader('Content-Type', note.mime);

    res.send(await note.getContent());
}

async function downloadFile(req, res) {
    const noteId = req.params.noteId;

    return await downloadNoteFile(noteId, res);

}

module.exports = {
    uploadFile,
    downloadFile,
    downloadNoteFile
};