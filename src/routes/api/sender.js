"use strict";

const imageType = require('image-type');
const imageService = require('../../services/image');
const noteService = require('../../services/notes');
const {sanitizeAttributeName} = require("../../services/sanitize_attribute_name.js");
const specialNotesService = require("../../services/special_notes.js");

function uploadImage(req) {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return [400, `Unknown image type: ${file.mimetype}`];
    }

    const originalName = `Sender image.${imageType(file.buffer).ext}`;

    const parentNote = specialNotesService.getInboxNote(req.headers['x-local-date']);

    const {note, noteId} = imageService.saveImage(parentNote.noteId, file.buffer, originalName, true);

    const labelsStr = req.headers['x-labels'];

    if (labelsStr?.trim()) {
        const labels = JSON.parse(labelsStr);

        for (const {name, value} of labels) {
            note.setLabel(sanitizeAttributeName(name), value);
        }
    }

    note.setLabel("sentFromSender");

    return {
        noteId: noteId
    };
}

function saveNote(req) {
    const parentNote = specialNotesService.getInboxNote(req.headers['x-local-date']);

    const {note, branch} = noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title: req.body.title,
        content: req.body.content,
        isProtected: false,
        type: 'text',
        mime: 'text/html'
    });

    if (req.body.labels) {
        for (const {name, value} of req.body.labels) {
            note.setLabel(sanitizeAttributeName(name), value);
        }
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
