"use strict";

const attributeService = require('../../services/attributes.js');
const cloneService = require('../../services/cloning.js');
const noteService = require('../../services/notes.js');
const dateNoteService = require('../../services/date_notes.js');
const dateUtils = require('../../services/date_utils.js');
const imageService = require('../../services/image.js');
const appInfo = require('../../services/app_info.js');
const ws = require('../../services/ws.js');
const log = require('../../services/log.js');
const utils = require('../../services/utils.js');
const path = require('path');
const htmlSanitizer = require('../../services/html_sanitizer.js');
const {formatAttrForSearch} = require('../../services/attribute_formatter.js');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

function addClipping(req) {
    // if a note under the clipperInbox has the same 'pageUrl' attribute,
    // add the content to that note and clone it under today's inbox
    // otherwise just create a new note under today's inbox
    let {title, content, pageUrl, images} = req.body;
    const clipType = 'clippings';

    const clipperInbox = getClipperInboxNote();

    pageUrl = htmlSanitizer.sanitizeUrl(pageUrl);
    let clippingNote = findClippingNote(clipperInbox, pageUrl, clipType);

    if (!clippingNote) {
        clippingNote = noteService.createNewNote({
            parentNoteId: clipperInbox.noteId,
            title: title,
            content: '',
            type: 'text'
        }).note;

        clippingNote.setLabel('clipType', 'clippings');
        clippingNote.setLabel('pageUrl', pageUrl);
        clippingNote.setLabel('iconClass', 'bx bx-globe');
    }

    const rewrittenContent = processContent(images, clippingNote, content);

    const existingContent = clippingNote.getContent();

    clippingNote.setContent(`${existingContent}${existingContent.trim() ? "<br>" : ""}${rewrittenContent}`);

    if (clippingNote.parentNoteId !== clipperInbox.noteId) {
        cloneService.cloneNoteToParentNote(clippingNote.noteId, clipperInbox.noteId);
    }

    return {
        noteId: clippingNote.noteId
    };
}

function findClippingNote(clipperInboxNote, pageUrl, clipType) {
    if (!pageUrl) {
        return null;
    }

    const notes = clipperInboxNote.searchNotesInSubtree(
        formatAttrForSearch({
            type: 'label',
            name: "pageUrl",
            value: pageUrl
        }, true)
    );

    return clipType
        ? notes.find(note => note.getOwnedLabelValue('clipType') === clipType)
        : notes[0];
}

function getClipperInboxNote() {
    let clipperInbox = attributeService.getNoteWithLabel('clipperInbox');

    if (!clipperInbox) {
        clipperInbox = dateNoteService.getDayNote(dateUtils.localNowDate());
    }

    return clipperInbox;
}

function createNote(req) {
    let {title, content, pageUrl, images, clipType, labels} = req.body;

    if (!title || !title.trim()) {
        title = `Clipped note from ${pageUrl}`;
    }

    clipType = htmlSanitizer.sanitize(clipType);

    const clipperInbox = getClipperInboxNote();
    pageUrl = htmlSanitizer.sanitizeUrl(pageUrl);
    let note = findClippingNote(clipperInbox, pageUrl, clipType);

    if (!note) {
        note = noteService.createNewNote({
            parentNoteId: clipperInbox.noteId,
            title,
            content: '',
            type: 'text'
        }).note;

        note.setLabel('clipType', clipType);

        if (pageUrl) {
            pageUrl = htmlSanitizer.sanitizeUrl(pageUrl);

            note.setLabel('pageUrl', pageUrl);
            note.setLabel('iconClass', 'bx bx-globe');
        }
    }

    if (labels) {
        for (const labelName in labels) {
            const labelValue = htmlSanitizer.sanitize(labels[labelName]);
            note.setLabel(labelName, labelValue);
        }
    }

    const existingContent = note.getContent();
    const rewrittenContent = processContent(images, note, content);
    const newContent = `${existingContent}${existingContent.trim() ? "<br/>" : ""}${rewrittenContent}`;
    note.setContent(newContent);

    noteService.asyncPostProcessContent(note, newContent); // to mark attachments as used

    return {
        noteId: note.noteId
    };
}

function processContent(images, note, content) {
    let rewrittenContent = htmlSanitizer.sanitize(content);

    if (images) {
        for (const {src, dataUrl, imageId} of images) {
            const filename = path.basename(src);

            if (!dataUrl || !dataUrl.startsWith("data:image")) {
                const excerpt = dataUrl
                    ? dataUrl.substr(0, Math.min(100, dataUrl.length))
                    : "null";

                log.info(`Image could not be recognized as data URL: ${excerpt}`);
                continue;
            }

            const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

            const attachment = imageService.saveImageToAttachment(note.noteId, buffer, filename, true);

            const encodedTitle = encodeURIComponent(attachment.title);
            const url = `api/attachments/${attachment.attachmentId}/image/${encodedTitle}`;

            log.info(`Replacing '${imageId}' with '${url}' in note '${note.noteId}'`);

            rewrittenContent = utils.replaceAll(rewrittenContent, imageId, url);
        }
    }

    // fallback if parsing/downloading images fails for some reason on the extension side (
    rewrittenContent = noteService.downloadImages(note.noteId, rewrittenContent);
    // Check if rewrittenContent contains at least one HTML tag
    if (!/<.+?>/.test(rewrittenContent)) {
        rewrittenContent = `<p>${rewrittenContent}</p>`;
    }
    // Create a JSDOM object from the existing HTML content
    const dom = new JSDOM(rewrittenContent);

    // Get the content inside the body tag and serialize it
    rewrittenContent = dom.window.document.body.innerHTML;

    return rewrittenContent;
}

function openNote(req) {
    if (utils.isElectron()) {
        ws.sendMessageToAllClients({
            type: 'openNote',
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

function findNotesByUrl(req){
    let pageUrl = req.params.noteUrl;
    const clipperInbox = getClipperInboxNote();
    let foundPage = findClippingNote(clipperInbox, pageUrl, null);
    return {
        noteId: foundPage ? foundPage.noteId : null
    }
}

module.exports = {
    createNote,
    addClipping,
    openNote,
    handshake,
    findNotesByUrl
};
