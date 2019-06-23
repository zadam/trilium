"use strict";

const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const log = require('../../services/log');
const path = require('path');
const Link = require('../../entities/link');

async function createNote(req) {
    const {title, html, url, images} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await noteService.createNote(todayNote.noteId, title, html, {
        attributes: [
            {
                type: 'label',
                name: 'sourceUrl',
                value: url
            }
        ]
    });

    let rewrittenHtml = html;

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

        rewrittenHtml = rewrittenHtml.replace(imageId, url);
    }

    console.log("Done", rewrittenHtml);

    await note.setContent(rewrittenHtml);

    return {};
}

async function createScreenshot(req) {
    console.log(req.body);

    const {imageDataUrl, title, url} = req.body;

    const prefix = "data:image/png;base64,";

    if (imageDataUrl.startsWith(prefix)) {
        const buffer = Buffer.from(imageDataUrl.substr(prefix.length), 'base64');

        const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

        const {note} = await imageService.saveImage(buffer, title + ".png", todayNote.noteId, true);

        await note.setLabel('sourceUrl', url);
    }
    else {
        console.log("Unrecognized prefix");
    }

    return {};
}

async function ping(req, res) {
    console.log("PING!!!!");

    res.status(200).send("TriliumClipperServer");
}

module.exports = {
    createNote,
    createScreenshot,
    ping
};