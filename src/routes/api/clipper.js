"use strict";

const attributeService = require("../../services/attributes");
const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const appInfo = require('../../services/app_info');
const ws = require('../../services/ws.js');
const log = require('../../services/log');
const utils = require('../../services/utils');
const path = require('path');
const Attribute = require('../../entities/attribute');

function findClippingNote(todayNote, pageUrl) {
    const notes = todayNote.getDescendantNotesWithLabel('pageUrl', pageUrl);

    for (const note of notes) {
        if (note.getOwnedLabelValue('clipType') === 'clippings') {
            return note;
        }
    }

    return null;
}

function getClipperInboxNote() {
    let clipperInbox = attributeService.getNoteWithLabel('clipperInbox');

    if (!clipperInbox) {
        clipperInbox = dateNoteService.getDateNote(dateUtils.localNowDate());
    }

    return clipperInbox;
}

function addClipping(req) {
    const {title, content, pageUrl, images} = req.body;

    const clipperInbox = getClipperInboxNote();

    let clippingNote = findClippingNote(clipperInbox, pageUrl);

    if (!clippingNote) {
        clippingNote = (noteService.createNewNote({
            parentNoteId: clipperInbox.noteId,
            title: title,
            content: '',
            type: 'text'
        })).note;

        clippingNote.setLabel('clipType', 'clippings');
        clippingNote.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = processContent(images, clippingNote, content);

    const existingContent = clippingNote.getContent();

    clippingNote.setContent(existingContent + (existingContent.trim() ? "<br/>" : "") + rewrittenContent);

    return {
        noteId: clippingNote.noteId
    };
}

function createNote(req) {
    let {title, content, pageUrl, images, clipType} = req.body;

    if (!title || !title.trim()) {
        title = "Clipped note from " + pageUrl;
    }
    const clipperInbox = getClipperInboxNote();

    const {note} = noteService.createNewNote({
        parentNoteId: clipperInbox.noteId,
        title,
        content,
        type: 'text'
    });

    note.setLabel('clipType', clipType);

    if (pageUrl) {
        note.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = processContent(images, note, content);

    note.setContent(rewrittenContent);

    return {
        noteId: note.noteId
    };
}

function processContent(images, note, content) {
    // H1 is not supported so convert it to H2
    let rewrittenContent = content
        .replace(/<h1/ig, "<h2")
        .replace(/<\/h1/ig, "</h2");

    if (images) {
        for (const {src, dataUrl, imageId} of images) {
            const filename = path.basename(src);

            if (!dataUrl.startsWith("data:image")) {
                log.info("Image could not be recognized as data URL:", dataUrl.substr(0, Math.min(100, dataUrl.length)));
                continue;
            }

            const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

            const {note: imageNote, url} = imageService.saveImage(note.noteId, buffer, filename, true);

            new Attribute({
                noteId: imageNote.noteId,
                type: 'label',
                name: 'archived'
            }).save(); // so that these image notes don't show up in search / autocomplete

            new Attribute({
                noteId: note.noteId,
                type: 'relation',
                name: 'imageLink',
                value: imageNote.noteId
            }).save();

            console.log(`Replacing ${imageId} with ${url}`);

            rewrittenContent = utils.replaceAll(rewrittenContent, imageId, url);
        }
    }

    return rewrittenContent;
}

function openNote(req) {
    if (utils.isElectron()) {
        ws.sendMessageToAllClients({
            type: 'open-note',
            noteId: req.params.noteId
        });

        return {
            result: 'ok'
        };
    }
    else {
        return {
            result: 'open-in-browser'
        }
    }
}

function handshake() {
    return {
        appName: "trilium",
        protocolVersion: appInfo.clipperProtocolVersion
    }
}

module.exports = {
    createNote,
    addClipping,
    openNote,
    handshake
};
