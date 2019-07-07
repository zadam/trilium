"use strict";

const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const appInfo = require('../../services/app_info');
const messagingService = require('../../services/messaging');
const log = require('../../services/log');
const path = require('path');
const Link = require('../../entities/link');

async function findClippingNote(todayNote, pageUrl) {
    const notes = await todayNote.getDescendantNotesWithLabel('pageUrl', pageUrl);

    for (const note of notes) {
        if (await note.getLabelValue('clipType') === 'clippings') {
            return note;
        }
    }

    return null;
}

async function addClipping(req) {
    const {title, content, pageUrl, images} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    let clippingNote = await findClippingNote(todayNote, pageUrl);

    if (!clippingNote) {
        clippingNote = (await noteService.createNote(todayNote.noteId, title, '')).note;

        await clippingNote.setLabel('clipType', 'clippings');
        await clippingNote.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = await addImagesToNote(images, clippingNote, content);

    await clippingNote.setContent(await clippingNote.getContent() + '<p>' + rewrittenContent + '</p>');

    return {
        noteId: clippingNote.noteId
    };
}

async function createNote(req) {
    const {title, content, pageUrl, images} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await noteService.createNote(todayNote.noteId, title, content);

    await note.setLabel('clipType', 'note');

    if (pageUrl) {
        await note.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = await addImagesToNote(images, note, content);

    await note.setContent(rewrittenContent);

    return {
        noteId: note.noteId
    };
}

async function addImagesToNote(images, note, content) {
    let rewrittenContent = content;

    if (images) {
        for (const {src, dataUrl, imageId} of images) {
            const filename = path.basename(src);

            if (!dataUrl.startsWith("data:image")) {
                log.info("Image could not be recognized as data URL:", dataUrl.substr(0, Math.min(100, dataUrl.length)));
                continue;
            }

            const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

            const {note: imageNote, url} = await imageService.saveImage(buffer, filename, note.noteId, true);

            await new Link({
                noteId: note.noteId,
                targetNoteId: imageNote.noteId,
                type: 'image'
            }).save();

            console.log(`Replacing ${imageId} with ${url}`);

            rewrittenContent = rewrittenContent.replace(imageId, url);
        }
    }

    return rewrittenContent;
}

async function createImage(req) {
    let {dataUrl, title, imageUrl, pageUrl} = req.body;

    if (!dataUrl) {
        // this is image inlined into the src attribute so there isn't any source image URL
        dataUrl = imageUrl;
        imageUrl = null;
    }

    if (!dataUrl.startsWith("data:image/")) {
        const message = "Unrecognized prefix: " + dataUrl.substr(0, Math.min(dataUrl.length, 100));
        log.info(message);

        return [400, message];
    }

    if (!title && imageUrl) {
        title = path.basename(imageUrl);
    }

    if (!title) {
        title = "clipped image";
    }

    const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await imageService.saveImage(buffer, title, todayNote.noteId, true);

    await note.setLabel('clipType', 'image');

    if (imageUrl) {
        await note.setLabel('imageUrl', imageUrl);
    }

    if (pageUrl) {
        await note.setLabel('pageUrl', pageUrl);
    }

    return {
        noteId: note.noteId
    };
}

async function openNote(req) {
    messagingService.sendMessageToAllClients({
        type: 'open-note',
        noteId: req.params.noteId
    });

    return {};
}

async function handshake() {
    return {
        appName: "trilium",
        appVersion: appInfo.appVersion
    }
}

module.exports = {
    createNote,
    createImage,
    addClipping,
    openNote,
    handshake
};