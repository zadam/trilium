"use strict";

const similarityService = require('../../becca/similarity');
const becca = require("../../becca/becca");

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = becca.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} not found.`];
    }

    return await similarityService.findSimilarNotes(noteId);
}

module.exports = {
    getSimilarNotes
};
