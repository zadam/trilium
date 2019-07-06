"use strict";

const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const messagingService = require('../../services/messaging');
const log = require('../../services/log');
const path = require('path');
const Link = require('../../entities/link');

async function createNote(req) {
    const {title, content, url, images} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await noteService.createNote(todayNote.noteId, title, content);

    if (url) {
        await note.setLabel('sourceUrl', url);
    }

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

    await note.setContent(rewrittenContent);

    return {
        noteId: note.noteId
    };
}

async function createImage(req) {
    let {dataUrl, title, sourceUrl, pageUrl} = req.body;

    if (!dataUrl) {
        dataUrl = sourceUrl;
        sourceUrl = null;
    }

    if (!dataUrl.startsWith("data:image/")) {
        const message = "Unrecognized prefix: " + dataUrl.substr(0, Math.min(dataUrl.length, 100));
        log.info(message);

        return [400, message];
    }

    if (!title && sourceUrl) {
        title = path.basename(sourceUrl);
    }

    if (!title) {
        title = "clipped image";
    }

    const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await imageService.saveImage(buffer, title, todayNote.noteId, true);

    if (sourceUrl) {
        await note.setLabel('sourceUrl', sourceUrl);
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

async function ping(req, res) {
    console.log("PING!!!!");

    res.status(200).send("TriliumClipperServer");
}

module.exports = {
    createNote,
    createImage,
    openNote,
    ping
};