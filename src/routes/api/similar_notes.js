"use strict";

const similarityService = require('../../services/note_cache/similarity.js');
const repository = require('../../services/repository');

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} not found.`];
    }

    return await similarityService.findSimilarNotes(noteId);
}

module.exports = {
    getSimilarNotes
};
