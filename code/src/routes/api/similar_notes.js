"use strict";

const similarityService = require('../../becca/similarity');
const becca = require("../../becca/becca");

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = becca.getNoteOrThrow(noteId);

    return await similarityService.findSimilarNotes(noteId);
}

module.exports = {
    getSimilarNotes
};
