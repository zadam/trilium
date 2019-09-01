"use strict";

const noteCacheService = require('../../services/note_cache');
const repository = require('../../services/repository');

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} not found.`];
    }

    const results = await noteCacheService.findSimilarNotes(note.title);

    return results
        .filter(note => note.noteId !== noteId);
}

module.exports = {
    getSimilarNotes
};