"use strict";

const noteCacheService = require('../../services/note_cache/note_cache_service');
const repository = require('../../services/repository');

async function getSimilarNotes(req) {
    const noteId = req.params.noteId;

    const note = repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} not found.`];
    }

    const results = await noteCacheService.findSimilarNotes(noteId);

    return results
        .filter(note => note.noteId !== noteId);
}

module.exports = {
    getSimilarNotes
};
