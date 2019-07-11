"use strict";

const imageType = require('image-type');
const imageService = require('../../services/image');
const dateNoteService = require('../../services/date_notes');
const noteService = require('../../services/notes');

async function uploadImage(req) {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const originalName = "Sender image." + imageType(file.buffer).ext;

    const parentNote = await dateNoteService.getDateNote(req.headers['x-local-date']);

    const {noteId} = await imageService.saveImage(file.buffer, originalName, parentNote.noteId, true);

    return {
        noteId: noteId
    };
}

async function saveNote(req) {
    const parentNote = await dateNoteService.getDateNote(req.headers['x-local-date']);

    const {note, branch} = await noteService.createNewNote(parentNote.noteId, {
        title: req.body.title,
        content: req.body.content,
        target: 'into',
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    });

    return {
        noteId: note.noteId,
        branchId: branch.branchId
    };
}

module.exports = {
    uploadImage,
    saveNote
};