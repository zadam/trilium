"use strict";

const imageType = require('image-type');
const imageService = require('../../services/image');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const noteService = require('../../services/notes');
const attributeService = require('../../services/attributes');
const {sanitizeAttributeName} = require("../../services/sanitize_attribute_name.js");

function uploadImage(req) {
    const file = req.file;

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return [400, `Unknown image type: ${file.mimetype}`];
    }

    const originalName = `Sender image.${imageType(file.buffer).ext}`;

    const parentNote = getSenderInboxNote();

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

function getSenderInboxNote() {
    let senderInbox = attributeService.getNoteWithLabel('senderInbox');

    if (!senderInbox) {
        senderInbox = dateNoteService.getDayNote(dateUtils.localNowDate());
    }

    return senderInbox;
}


function saveNote(req) {
    const parentNote = getSenderInboxNote();

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
