"use strict";

const attributeService = require("../../services/attributes");
const cloneService = require("../../services/cloning");
const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const appInfo = require('../../services/app_info');
const ws = require('../../services/ws');
const log = require('../../services/log');
const utils = require('../../services/utils');
const path = require('path');
const BAttribute = require('../../becca/entities/battribute');
const htmlSanitizer = require('../../services/html_sanitizer');
const {formatAttrForSearch} = require("../../services/attribute_formatter");

function findClippingNote(clipperInboxNote, pageUrl) {
    //Avoid searching for empty of browser pages like about:blank
    if (pageUrl.trim().length > 1 && pageUrl.trim().indexOf('about:') != 0 ){
        const notes = clipperInboxNote.searchNotesInSubtree(
            formatAttrForSearch({
                type: 'label',
                name: "pageUrl",
                value: pageUrl
            }, true)
        );

        for (const note of notes) {
            if (note.getOwnedLabelValue('clipType') === 'note') {
                return note;
            }
        }
    }

    return null;
}

function getClipperInboxNote() {
    let clipperInbox = attributeService.getNoteWithLabel('clipperInbox');

    if (!clipperInbox) {
        clipperInbox = dateNoteService.getRootCalendarNote();
    }

    return clipperInbox;
}

function addClipping(req) {
    //if a note under the clipperInbox as the same 'pageUrl' attribute, add the content to that note
    //and clone it under today's inbox
    //otherwise just create a new note under today's inbox
    let {title, content, pageUrl, images} = req.body;

    //this is only for reference
    const clipperInbox = getClipperInboxNote();
    const dailyNote = dateNoteService.getDayNote(dateUtils.localNowDate());

    pageUrl = htmlSanitizer.sanitizeUrl(pageUrl);
    let clippingNote = findClippingNote(clipperInbox, pageUrl);
    
    if (!clippingNote) {
        clippingNote = noteService.createNewNote({
            parentNoteId: dailyNote.noteId,
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

    clippingNote.setContent(`${existingContent}${existingContent.trim() ? "<br/>" : ""}${rewrittenContent}`);
    
    if (clippingNote.parentNoteId != dailyNote.noteId){
        cloneService.cloneNoteToParentNote(clippingNote.noteId, dailyNote.noteId);
    }
    return {
        noteId: clippingNote.noteId
    };
}

function createNote(req) {
    let {title, content, pageUrl, images, clipType, labels} = req.body;

    if (!title || !title.trim()) {
        title = `Clipped note from ${pageUrl}`;
    }

    const clipperInbox = getClipperInboxNote();
    const dailyNote = dateNoteService.getDayNote(dateUtils.localNowDate());
    pageUrl = htmlSanitizer.sanitizeUrl(pageUrl);
    let note = findClippingNote(clipperInbox, pageUrl);

    if (!note){
        note = noteService.createNewNote({
            parentNoteId: dailyNote.noteId,
            title,
            content,
            type: 'text'
        }).note;
        clipType = htmlSanitizer.sanitize(clipType);

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
    note.setContent(`${existingContent}${existingContent.trim() ? "<br/>" : ""}${rewrittenContent}`);

    // note.setContent(rewrittenContent);

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

            const {note: imageNote, url} = imageService.saveImage(note.noteId, buffer, filename, true);

            new BAttribute({
                noteId: imageNote.noteId,
                type: 'label',
                name: 'archived'
            }).save(); // so that these image notes don't show up in search / autocomplete

            new BAttribute({
                noteId: note.noteId,
                type: 'relation',
                name: 'imageLink',
                value: imageNote.noteId
            }).save();

            log.info(`Replacing '${imageId}' with '${url}' in note '${note.noteId}'`);

            rewrittenContent = utils.replaceAll(rewrittenContent, imageId, url);
        }
    }

    // fallback if parsing/downloading images fails for some reason on the extension side (
    rewrittenContent = noteService.downloadImages(note.noteId, rewrittenContent);

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
    let foundPage = findClippingNote(clipperInbox, pageUrl);
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
