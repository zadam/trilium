"use strict";

const becca = require('../../becca/becca');
const SearchContext = require('../../services/search/search_context');
const log = require('../../services/log');
const scriptService = require('../../services/script');
const searchService = require('../../services/search/services/search');
const bulkActionService = require("../../services/bulk_actions");
const {formatAttrForSearch} = require("../../services/attribute_formatter");

function searchFromNoteInt(note) {
    let searchResultNoteIds, highlightedTokens;

    const searchScript = note.getRelationValue('searchScript');
    const searchString = note.getLabelValue('searchString');

    if (searchScript) {
        searchResultNoteIds = searchFromRelation(note, 'searchScript');
        highlightedTokens = [];
    } else {
        const searchContext = new SearchContext({
            fastSearch: note.hasLabel('fastSearch'),
            ancestorNoteId: note.getRelationValue('ancestor'),
            ancestorDepth: note.getLabelValue('ancestorDepth'),
            includeArchivedNotes: note.hasLabel('includeArchivedNotes'),
            orderBy: note.getLabelValue('orderBy'),
            orderDirection: note.getLabelValue('orderDirection'),
            limit: note.getLabelValue('limit'),
            debug: note.hasLabel('debug'),
            fuzzyAttributeSearch: false
        });

        searchResultNoteIds = searchService.findResultsWithQuery(searchString, searchContext)
            .map(sr => sr.noteId);

        highlightedTokens = searchContext.highlightedTokens;
    }

    // we won't return search note's own noteId
    // also don't allow root since that would force infinite cycle
    return {
        searchResultNoteIds: searchResultNoteIds.filter(resultNoteId => !['root', note.noteId].includes(resultNoteId)),
        highlightedTokens
    };
}

function searchFromNote(req) {
    const note = becca.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        // this can be triggered from recent changes, and it's harmless to return empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not a search note.`]
    }

    return searchFromNoteInt(note);
}

function searchAndExecute(req) {
    const note = becca.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        // this can be triggered from recent changes and it's harmless to return empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not a search note.`]
    }

    const {searchResultNoteIds} = searchFromNoteInt(note);

    bulkActionService.executeActions(note, searchResultNoteIds);
}

function searchFromRelation(note, relationName) {
    const scriptNote = note.getRelationTarget(relationName);

    if (!scriptNote) {
        log.info(`Search note's relation ${relationName} has not been found.`);

        return [];
    }

    if (!scriptNote.isJavaScript() || scriptNote.getScriptEnv() !== 'backend') {
        log.info(`Note ${scriptNote.noteId} is not executable.`);

        return [];
    }

    if (!note.isContentAvailable()) {
        log.info(`Note ${scriptNote.noteId} is not available outside of protected session.`);

        return [];
    }

    const result = scriptService.executeNote(scriptNote, { originEntity: note });

    if (!Array.isArray(result)) {
        log.info(`Result from ${scriptNote.noteId} is not an array.`);

        return [];
    }

    if (result.length === 0) {
        return [];
    }

    // we expect either array of noteIds (strings) or notes, in that case we extract noteIds ourselves
    return typeof result[0] === 'string' ? result : result.map(item => item.noteId);
}

function quickSearch(req) {
    const {searchString} = req.params;

    const searchContext = new SearchContext({
        fastSearch: false,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: false
    });

    return searchService.findResultsWithQuery(searchString, searchContext)
        .map(sr => sr.noteId);
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
    const query = formatAttrForSearch({type: 'label', name: "template"}, false);

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
