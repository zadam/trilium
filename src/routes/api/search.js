"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const noteService = require('../../services/notes');
const noteCacheService = require('../../services/note_cache');
const parseFilters = require('../../services/parse_filters');
const buildSearchQuery = require('../../services/build_search_query');

async function searchNotes(req) {
    const filters = parseFilters(req.params.searchString);

    const {query, params} = buildSearchQuery(filters);

    const labelFiltersNoteIds = await sql.getColumn(query, params);

    return labelFiltersNoteIds.map(noteCacheService.getNotePath).filter(res => !!res);
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