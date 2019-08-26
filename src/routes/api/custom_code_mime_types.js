"use strict";

const attributesService = require('../../services/attributes');
const log = require('../../services/log');

async function get() {
    const notes = await attributesService.getNotesWithLabel('codeMimeTypes');
    let merged = [];

    for (const note of notes) {
        try {
            merged = merged.concat(await note.getJsonContent());
        }
        catch (e) {
            log.error(`Cannot merge mime types from note=${note.noteId}: ${e.message}`);
        }
    }

    return merged;
}

module.exports = {
    get
};