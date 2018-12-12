"use strict";

const sql = require('../../services/sql');
const noteService = require('../../services/notes');
const noteCacheService = require('../../services/note_cache');
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
        searchTextResults = await noteCacheService.findNotes(searchText);

        let fullTextNoteIds = await getFullTextResults(searchText);

        for (const noteId of fullTextNoteIds) {
            if (!searchTextResults.some(item => item.noteId === noteId)) {
                const result = noteCacheService.getNotePath(noteId);

                if (result) {
                    searchTextResults.push(result);
                }
            }
        }
    }

    let results;

    if (labelFiltersNoteIds && searchTextResults) {
        results = searchTextResults.filter(item => labelFiltersNoteIds.includes(item.noteId));
    }
    else if (labelFiltersNoteIds) {
        results = labelFiltersNoteIds.map(noteCacheService.getNotePath).filter(res => !!res);
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
        // FIXME: escape token!
        tokenSql.push(`(title LIKE '%${token}%' OR content LIKE '%${token}%')`);
    }

    const noteIds = await sql.getColumn(`
      SELECT DISTINCT noteId 
      FROM notes 
      WHERE isDeleted = 0 
        AND isProtected = 0
        AND type IN ('text', 'code')
        AND ${tokenSql.join(' AND ')}`);

    return noteIds;
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