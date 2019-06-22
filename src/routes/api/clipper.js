"use strict";

const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');

async function createNote(req) {
    console.log(req.body);

    const {title, html, source_url} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    await noteService.createNote(todayNote.noteId, title, html, {
        attributes: [
            {
                type: 'label',
                name: 'sourceUrl',
                value: source_url
            }
        ]
    });

    return {};
}

async function createScreenshot(req) {
    console.log(req.body);

    const {imageDataUrl, title, url} = req.body;

    const prefix = "data:image/png;base64,";

    if (imageDataUrl.startsWith(prefix)) {
        const buffer = Buffer.from(imageDataUrl.substr(prefix.length), 'base64');

        const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

        const {note} = await imageService.saveImage(buffer, title, todayNote.noteId, true);

        await note.setLabel('sourceUrl', url);
    }
    else {
        console.log("Unrecognized prefix");
    }
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