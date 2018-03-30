"use strict";

const sql = require('../../services/sql');
const notes = require('../../services/notes');
const parseFilters = require('../../services/parse_filters');
const buildSearchQuery = require('../../services/build_search_query');

async function searchNotes(req) {
    const {attrFilters, searchText} = parseFilters(req.params.searchString);

    const {query, params} = buildSearchQuery(attrFilters, searchText);

    const noteIds = await sql.getColumn(query, params);

    return noteIds;
}

async function saveSearchToNote(req) {
    const noteContent = {
        searchString: req.params.searchString
    };

    const noteId = await notes.createNote('root', 'Search note', noteContent, {
        json: true,
        type: 'search',
        mime: "application/json"
    });

    return { noteId };
}

module.exports = {
    searchNotes,
    saveSearchToNote
};