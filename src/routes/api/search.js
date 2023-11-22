"use strict";

const becca = require('../../becca/becca.js');
const SearchContext = require('../../services/search/search_context.js');
const searchService = require('../../services/search/services/search.js');
const bulkActionService = require('../../services/bulk_actions.js');
const cls = require('../../services/cls.js');
const {formatAttrForSearch} = require('../../services/attribute_formatter.js');
const ValidationError = require('../../errors/validation_error.js');

function searchFromNote(req) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    if (!note) {
        // this can be triggered from recent changes, and it's harmless to return an empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        throw new ValidationError(`Note '${req.params.noteId}' is not a search note.`);
    }

    return searchService.searchFromNote(note);
}

function searchAndExecute(req) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    if (!note) {
        // this can be triggered from recent changes, and it's harmless to return an empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        throw new ValidationError(`Note '${req.params.noteId}' is not a search note.`);
    }

    const {searchResultNoteIds} = searchService.searchFromNote(note);

    bulkActionService.executeActions(note, searchResultNoteIds);
}

function quickSearch(req) {
    const {searchString} = req.params;

    const searchContext = new SearchContext({
        fastSearch: false,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: false
    });

    const resultNoteIds = searchService.findResultsWithQuery(searchString, searchContext)
        .map(sr => sr.noteId);

    return {
        searchResultNoteIds: resultNoteIds,
        error: searchContext.getError()
    };
}

function search(req) {
    const {searchString} = req.params;

    const searchContext = new SearchContext({
        fastSearch: false,
        includeArchivedNotes: true,
        fuzzyAttributeSearch: false,
        ignoreHoistedNote: true
    });

    return searchService.findResultsWithQuery(searchString, searchContext)
        .map(sr => sr.noteId);
}

function getRelatedNotes(req) {
    const attr = req.body;

    const searchSettings = {
        fastSearch: true,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: false
    };

    const matchingNameAndValue = searchService.findResultsWithQuery(formatAttrForSearch(attr, true), new SearchContext(searchSettings));
    const matchingName = searchService.findResultsWithQuery(formatAttrForSearch(attr, false), new SearchContext(searchSettings));

    const results = [];

    const allResults = matchingNameAndValue.concat(matchingName);

    const allResultNoteIds = new Set();

    for (const record of allResults) {
        allResultNoteIds.add(record.noteId);
    }

    for (const record of allResults) {
        if (results.length >= 20) {
            break;
        }

        if (results.find(res => res.noteId === record.noteId)) {
            continue;
        }

        results.push(record);
    }

    return {
        count: allResultNoteIds.size,
        results
    };
}

function searchTemplates() {
    const query = cls.getHoistedNoteId() === 'root'
        ? '#template'
        : '#template OR #workspaceTemplate';

    return searchService.searchNotes(query, {
        includeArchivedNotes: true,
        ignoreHoistedNote: false
    }).map(note => note.noteId);
}

module.exports = {
    searchFromNote,
    searchAndExecute,
    getRelatedNotes,
    quickSearch,
    search,
    searchTemplates
};
