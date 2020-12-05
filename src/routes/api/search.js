"use strict";

const repository = require('../../services/repository');
const SearchContext = require('../../services/search/search_context.js');
const log = require('../../services/log');
const scriptService = require('../../services/script');
const searchService = require('../../services/search/services/search');

async function searchFromNote(req) {
    const note = repository.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        // this can be triggered from recent changes and it's harmless to return empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not search note.`]
    }

    let searchResultNoteIds;

    try {
        const searchScript = note.getRelationValue('searchScript');
        const searchString = note.getLabelValue('searchString');

        if (searchScript) {
            searchResultNoteIds = await searchFromRelation(note, 'searchScript');
        }
        else if (searchString) {
            const searchContext = new SearchContext({
                includeNoteContent: note.getLabelValue('includeNoteContent') === 'true',
                subTreeNoteId: note.getLabelValue('subTreeNoteId'),
                excludeArchived: true,
                fuzzyAttributeSearch: false
            });

            searchResultNoteIds = searchService.findNotesWithQuery(searchString, searchContext)
                .map(sr => sr.noteId);
        }
        else {
            searchResultNoteIds = [];
        }
    }
    catch (e) {
        log.error(`Search failed for note ${note.noteId}: ` + e.message + ": " + e.stack);

        throw new Error("Search failed, see logs for details.");
    }

    // we won't return search note's own noteId
    // also don't allow root since that would force infinite cycle
    searchResultNoteIds = searchResultNoteIds.filter(resultNoteId => !['root', note.noteId].includes(resultNoteId));

    if (searchResultNoteIds.length > 200) {
        searchResultNoteIds = searchResultNoteIds.slice(0, 200);
    }

    return searchResultNoteIds;
}

async function searchFromRelation(note, relationName) {
    const scriptNote = note.getRelationTarget(relationName);

    if (!scriptNote) {
        log.info(`Search note's relation ${relationName} has not been found.`);

        return [];
    }

    if (!scriptNote.isJavaScript() || scriptNote.getScriptEnv() !== 'backend') {
        log.info(`Note ${scriptNote.noteId} is not executable.`);

        return [];
    }

    if (!note.isContentAvailable) {
        log.info(`Note ${scriptNote.noteId} is not available outside of protected session.`);

        return [];
    }

    const result = await scriptService.executeNote(scriptNote, { originEntity: note });

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

function getRelatedNotes(req) {
    const attr = req.body;

    const searchSettings = {
        includeNoteContent: false,
        excludeArchived: true,
        fuzzyAttributeSearch: false
    };

    const matchingNameAndValue = searchService.findNotesWithQuery(formatAttrForSearch(attr, true), new SearchContext(searchSettings));
    const matchingName = searchService.findNotesWithQuery(formatAttrForSearch(attr, false), new SearchContext(searchSettings));

    const results = [];

    for (const record of matchingNameAndValue.concat(matchingName)) {
        if (results.length >= 20) {
            break;
        }

        if (results.find(res => res.noteId === record.noteId)) {
            continue;
        }

        results.push(record);
    }

    return {
        count: matchingName.length,
        results
    };
}

function formatAttrForSearch(attr, searchWithValue) {
    let searchStr = '';

    if (attr.type === 'label') {
        searchStr += '#';
    }
    else if (attr.type === 'relation') {
        searchStr += '~';
    }
    else {
        throw new Error(`Unrecognized attribute type ${JSON.stringify(attr)}`);
    }

    searchStr += attr.name;

    if (searchWithValue && attr.value) {
        searchStr += '=';
        searchStr += formatValue(attr.value);
    }

    return searchStr;
}

function formatValue(val) {
    if (!/[^\w_-]/.test(val)) {
        return val;
    }
    else if (!val.includes('"')) {
        return '"' + val + '"';
    }
    else if (!val.includes("'")) {
        return "'" + val + "'";
    }
    else if (!val.includes("`")) {
        return "`" + val + "`";
    }
    else {
        return '"' + val.replace(/"/g, '\\"') + '"';
    }
}

module.exports = {
    searchFromNote,
    getRelatedNotes
};
