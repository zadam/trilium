"use strict";

const similarityService = require('../../becca/similarity');
const becca = require("../../becca/becca");
const NotFoundError = require("../../errors/not_found_error");

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' not found.`);
    }

    return await similarityService.findSimilarNotes(noteId);
}

module.exports = {
    getSimilarNotes
};
