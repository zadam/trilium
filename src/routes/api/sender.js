"use strict";

const imageType = require('image-type');
const imageService = require('../../services/image');
const dateNoteService = require('../../services/date_notes');
const noteService = require('../../services/notes');

function uploadImage(req) {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const originalName = "Sender image." + imageType(file.buffer).ext;

    const parentNote = dateNoteService.getDateNote(req.headers['x-local-date']);

    const {noteId} = imageService.saveImage(parentNote.noteId, file.buffer, originalName, true);

    return {
        noteId: noteId
    };
}

function saveNote(req) {
    const parentNote = dateNoteService.getDateNote(req.headers['x-local-date']);

    const {note, branch} = noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title: req.body.title,
        content: req.body.content,
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    });

    if (req.body.label && req.body.label.trim()){
        let value;
        if (req.body.labelValue && req.body.labelValue.trim()){
            value = req.body.labelValue;
        }
        note.setLabel(req.body.label, value);
    }

    return {
        noteId: note.noteId,
        branchId: branch.branchId
    };
}

module.exports = {
    uploadImage,
    saveNote
};
