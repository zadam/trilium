"use strict";

const sql = require('../../services/sql');
const noteService = require('../../services/notes');
const autocompleteService = require('../../services/autocomplete');
const utils = require('../../services/utils');
const parseFilters = require('../../services/parse_filters');
const buildSearchQuery = require('../../services/build_search_query');

async function searchNotes(req) {
    const {labelFilters, searchText} = parseFilters(req.params.searchString);

    let labelFiltersNoteIds = null;

    if (labelFilters.length > 0) {
        const {query, params} = buildSearchQuery(labelFilters, searchText);

        labelFiltersNoteIds = await sql.getColumn(query, params);
    }

    let searchTextResults = null;

    if (searchText.trim().length > 0) {
        searchTextResults = autocompleteService.getResults(searchText);

        let fullTextNoteIds = await getFullTextResults(searchText);

        for (const noteId of fullTextNoteIds) {
            if (!searchTextResults.some(item => item.noteId === noteId)) {
                const result = autocompleteService.getResult(noteId);

                if (result) {
                    searchTextResults.push(result);
                }
            }
        }
    }

    let results;

    if (labelFiltersNoteIds && searchTextResults) {
        results = labelFiltersNoteIds.filter(item => searchTextResults.includes(item.noteId));
    }
    else if (labelFiltersNoteIds) {
        results = labelFiltersNoteIds.map(autocompleteService.getResult).filter(res => !!res);
    }
    else {
        results = searchTextResults;
    }

    return results;
}

async function getFullTextResults(searchText) {
    const tokens = searchText.toLowerCase().split(" ");
    const tokenSql = ["1=1"];

    for (const token of tokens) {
        tokenSql.push(`content LIKE '%${token}%'`);
    }

    const noteIds = await sql.getColumn(`
      SELECT DISTINCT noteId 
      FROM notes 
      WHERE isDeleted = 0 
        AND isProtected = 0
        AND ${tokenSql.join(' AND ')}`);

    return noteIds;
}

async function saveSearchToNote(req) {
    const noteContent = {
        searchString: req.params.searchString
    };

    const {note} = await noteService.createNote('root', 'Search note', noteContent, {
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