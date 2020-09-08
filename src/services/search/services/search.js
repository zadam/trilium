"use strict";

const lex = require('./lex.js');
const handleParens = require('./handle_parens.js');
const parse = require('./parse.js');
const NoteSet = require("../note_set.js");
const SearchResult = require("../search_result.js");
const SearchContext = require("../search_context.js");
const noteCache = require('../../note_cache/note_cache.js');
const noteCacheService = require('../../note_cache/note_cache_service.js');
const hoistedNoteService = require('../../hoisted_note.js');
const repository = require('../../repository.js');
const utils = require('../../utils.js');

/**
 * @param {Expression} expression
 * @return {SearchResult[]}
 */
function findNotesWithExpression(expression) {
    const hoistedNote = noteCache.notes[hoistedNoteService.getHoistedNoteId()];
    const allNotes = (hoistedNote && hoistedNote.noteId !== 'root')
        ? hoistedNote.subtreeNotes
        : Object.values(noteCache.notes);

    const allNoteSet = new NoteSet(allNotes);

    const searchContext = {
        noteIdToNotePath: {}
    };

    const noteSet = expression.execute(allNoteSet, searchContext);

    const searchResults = noteSet.notes
        .map(note => searchContext.noteIdToNotePath[note.noteId] || noteCacheService.getSomePath(note))
        .filter(notePathArray => notePathArray.includes(hoistedNoteService.getHoistedNoteId()))
        .map(notePathArray => new SearchResult(notePathArray));

    if (!noteSet.sorted) {
        // sort results by depth of the note. This is based on the assumption that more important results
        // are closer to the note root.
        searchResults.sort((a, b) => {
            if (a.notePathArray.length === b.notePathArray.length) {
                return a.notePathTitle < b.notePathTitle ? -1 : 1;
            }

            return a.notePathArray.length < b.notePathArray.length ? -1 : 1;
        });
    }

    return searchResults;
}

function parseQueryToExpression(query, searchContext) {
    const {fulltextTokens, expressionTokens} = lex(query);
    const structuredExpressionTokens = handleParens(expressionTokens);

    const expression = parse({
        fulltextTokens,
        expressionTokens: structuredExpressionTokens,
        searchContext,
        originalQuery: query
    });

    return expression;
}

/**
 * @param {string} query
 * @param {SearchContext} searchContext
 * @return {SearchResult[]}
 */
function findNotesWithQuery(query, searchContext) {
    if (!query.trim().length) {
        return [];
    }

    return utils.stopWatch(`Search with query "${query}"`, () => {
        const expression = parseQueryToExpression(query, searchContext);

        if (!expression) {
            return [];
        }

        return findNotesWithExpression(expression);
    }, 20);
}

function searchTrimmedNotes(query, searchContext) {
    const allSearchResults = findNotesWithQuery(query, searchContext);
    const trimmedSearchResults = allSearchResults.slice(0, 200);

    return {
        count: allSearchResults.length,
        results: trimmedSearchResults
    };
}

function searchNotesForAutocomplete(query) {
    const searchContext = new SearchContext({
        includeNoteContent: false,
        excludeArchived: true,
        fuzzyAttributeSearch: true
    });

    const {results} = searchTrimmedNotes(query, searchContext);

    highlightSearchResults(results, searchContext.highlightedTokens);

    return results.map(result => {
        return {
            notePath: result.notePath,
            noteTitle: noteCacheService.getNoteTitle(result.noteId),
            notePathTitle: result.notePathTitle,
            highlightedNotePathTitle: result.highlightedNotePathTitle
        }
    });
}

function highlightSearchResults(searchResults, highlightedTokens) {
    highlightedTokens = Array.from(new Set(highlightedTokens));

    // we remove < signs because they can cause trouble in matching and overwriting existing highlighted chunks
    // which would make the resulting HTML string invalid.
    // { and } are used for marking <b> and </b> tag (to avoid matches on single 'b' character)
    highlightedTokens = highlightedTokens.map(token => token.replace('/[<\{\}]/g', ''));

    // sort by the longest so we first highlight longest matches
    highlightedTokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of searchResults) {
        const note = noteCache.notes[result.noteId];

        result.highlightedNotePathTitle = result.notePathTitle;

        if (highlightedTokens.find(token => note.type.includes(token))) {
            result.highlightedNotePathTitle += ` <small>type: ${note.type}</small>`;
        }

        if (highlightedTokens.find(token => note.mime.includes(token))) {
            result.highlightedNotePathTitle += ` <small>mime: ${note.mime}</small>`;
        }

        for (const attr of note.attributes) {
            if (highlightedTokens.find(token => attr.name.includes(token) || attr.value.includes(token))) {
                result.highlightedNotePathTitle += ` <small>${formatAttribute(attr)}</small>`;
            }
        }
    }

    for (const token of highlightedTokens) {
        const tokenRegex = new RegExp("(" + utils.escapeRegExp(token) + ")", "gi");

        for (const result of searchResults) {
            result.highlightedNotePathTitle = result.highlightedNotePathTitle.replace(tokenRegex, "{$1}");
        }
    }

    for (const result of searchResults) {
        result.highlightedNotePathTitle = result.highlightedNotePathTitle
            .replace(/{/g, "<b>")
            .replace(/}/g, "</b>");
    }
}

function formatAttribute(attr) {
    if (attr.type === 'relation') {
        return '~' + utils.escapeHtml(attr.name) + "=…";
    }
    else if (attr.type === 'label') {
        let label = '#' + utils.escapeHtml(attr.name);

        if (attr.value) {
            const val = /[^\w_-]/.test(attr.value) ? '"' + attr.value + '"' : attr.value;

            label += '=' + utils.escapeHtml(val);
        }

        return label;
    }
}

module.exports = {
    searchTrimmedNotes,
    searchNotesForAutocomplete,
    findNotesWithQuery
};
