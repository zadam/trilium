"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
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
    const safeSearchText = utils.sanitizeSql(searchText);

    return await sql.getColumn(`SELECT noteId FROM note_fulltext 
                                       WHERE note_fulltext MATCH '${safeSearchText}'`);
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