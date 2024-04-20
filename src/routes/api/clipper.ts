"use strict";

import { Request } from "express";

import attributeService = require('../../services/attributes');
import cloneService = require('../../services/cloning');
import noteService = require('../../services/notes');
import dateNoteService = require('../../services/date_notes');
import dateUtils = require('../../services/date_utils');
import imageService = require('../../services/image');
import appInfo = require('../../services/app_info');
import ws = require('../../services/ws');
import log = require('../../services/log');
import utils = require('../../services/utils');
import path = require('path');
import htmlSanitizer = require('../../services/html_sanitizer');
import attributeFormatter = require('../../services/attribute_formatter');
import jsdom = require("jsdom");
import BNote = require("../../becca/entities/bnote");
import ValidationError = require("../../errors/validation_error");
const { JSDOM } = jsdom;

interface Image {
    src: string;
    dataUrl: string;
    imageId: string;
}

function addClipping(req: Request) {
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
    if (typeof existingContent !== "string") {
        throw new ValidationError("Invalid note content type.");
    }

    clippingNote.setContent(`${existingContent}${existingContent.trim() ? "<br>" : ""}${rewrittenContent}`);

    // TODO: Is parentNoteId ever defined?
    if ((clippingNote as any).parentNoteId !== clipperInbox.noteId) {
        cloneService.cloneNoteToParentNote(clippingNote.noteId, clipperInbox.noteId);
    }

    return {
        noteId: clippingNote.noteId
    };
}

function findClippingNote(clipperInboxNote: BNote, pageUrl: string, clipType: string | null) {
    if (!pageUrl) {
        return null;
    }

    const notes = clipperInboxNote.searchNotesInSubtree(
        attributeFormatter.formatAttrForSearch({
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

function createNote(req: Request) {
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
    if (typeof existingContent !== "string") {
        throw new ValidationError("Invalid note content tpye.");
    }
    const rewrittenContent = processContent(images, note, content);
    const newContent = `${existingContent}${existingContent.trim() ? "<br/>" : ""}${rewrittenContent}`;
    note.setContent(newContent);

    noteService.asyncPostProcessContent(note, newContent); // to mark attachments as used

    return {
        noteId: note.noteId
    };
}

function processContent(images: Image[], note: BNote, content: string) {
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

function openNote(req: Request) {
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

function findNotesByUrl(req: Request){
    let pageUrl = req.params.noteUrl;
    const clipperInbox = getClipperInboxNote();
    let foundPage = findClippingNote(clipperInbox, pageUrl, null);
    return {
        noteId: foundPage ? foundPage.noteId : null
    }
}

export = {
    createNote,
    addClipping,
    openNote,
    handshake,
    findNotesByUrl
};
