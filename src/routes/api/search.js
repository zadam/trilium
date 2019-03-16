"use strict";

const noteService = require('../../services/notes');
const noteCacheService = require('../../services/note_cache');
const searchService = require('../../services/search');

async function searchNotes(req) {
    const noteIds = await searchService.searchForNoteIds(req.params.searchString);

    return noteIds.map(noteCacheService.getNotePath).filter(res => !!res);
}

async function saveSearchToNote(req) {
    const noteContent = {
        searchString: req.params.searchString
    };

    const {note} = await noteService.createNote('root', req.params.searchString, noteContent, {
        json: true,
        type: 'search',
        mime: "application/json"
    });

    return { noteId: note.noteId };
}

module.exports = {
    searchNotes,
    saveSearchToNote
};