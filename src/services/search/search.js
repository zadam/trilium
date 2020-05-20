"use strict";

const lexer = require('./lexer');
const parens = require('./parens');
const parser = require('./parser');
const NoteSet = require("./note_set");
const SearchResult = require("./search_result");
const noteCache = require('../note_cache/note_cache');
const noteCacheService = require('../note_cache/note_cache_service');
const hoistedNoteService = require('../hoisted_note');
const utils = require('../utils');

async function findNotesWithExpression(expression) {
    const hoistedNote = noteCache.notes[hoistedNoteService.getHoistedNoteId()];
    const allNotes = (hoistedNote && hoistedNote.noteId !== 'root')
        ? hoistedNote.subtreeNotes
        : Object.values(noteCache.notes);

    const allNoteSet = new NoteSet(allNotes);

    const searchContext = {
        noteIdToNotePath: {}
    };

    const noteSet = await expression.execute(allNoteSet, searchContext);

    let searchResults = noteSet.notes
        .map(note => searchContext.noteIdToNotePath[note.noteId] || noteCacheService.getSomePath(note))
        .filter(notePathArray => notePathArray.includes(hoistedNoteService.getHoistedNoteId()))
        .map(notePathArray => new SearchResult(notePathArray));

    // sort results by depth of the note. This is based on the assumption that more important results
    // are closer to the note root.
    searchResults.sort((a, b) => {
        if (a.notePathArray.length === b.notePathArray.length) {
            return a.notePathTitle < b.notePathTitle ? -1 : 1;
        }

        return a.notePathArray.length < b.notePathArray.length ? -1 : 1;
    });

    return searchResults;
}

function parseQueryToExpression(query) {
    const {fulltextTokens, expressionTokens} = lexer(query);
    const structuredExpressionTokens = parens(expressionTokens);
    const expression = parser(fulltextTokens, structuredExpressionTokens, false);

    return expression;
}

async function searchNotesForAutocomplete(query) {
    if (!query.trim().length) {
        return [];
    }

    const expression = parseQueryToExpression(query);

    if (!expression) {
        return [];
    }

    let searchResults = await findNotesWithExpression(expression);

    searchResults = searchResults.slice(0, 200);

    highlightSearchResults(searchResults, query);

    return searchResults.map(result => {
        return {
            notePath: result.notePath,
            notePathTitle: result.notePathTitle,
            highlightedNotePathTitle: result.highlightedNotePathTitle
        }
    });
}

function highlightSearchResults(searchResults, query) {
    let tokens = query
        .trim() // necessary because even with .split() trailing spaces are tokens which causes havoc
        .toLowerCase()
        .split(/[ -]/)
        .filter(token => token !== '/');

    // we remove < signs because they can cause trouble in matching and overwriting existing highlighted chunks
    // which would make the resulting HTML string invalid.
    // { and } are used for marking <b> and </b> tag (to avoid matches on single 'b' character)
    tokens = tokens.map(token => token.replace('/[<\{\}]/g', ''));

    // sort by the longest so we first highlight longest matches
    tokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of searchResults) {
        const note = noteCache.notes[result.noteId];

        result.highlightedNotePathTitle = result.notePathTitle;

        for (const attr of note.attributes) {
            if (tokens.find(token => attr.name.includes(token) || attr.value.includes(token))) {
                result.highlightedNotePathTitle += ` <small>${formatAttribute(attr)}</small>`;
            }
        }
    }

    for (const token of tokens) {
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
        return '@' + utils.escapeHtml(attr.name) + "=…";
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
    searchNotesForAutocomplete
};
