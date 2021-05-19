"use strict";

const lex = require('./lex.js');
const handleParens = require('./handle_parens.js');
const parse = require('./parse.js');
const NoteSet = require("../note_set.js");
const SearchResult = require("../search_result.js");
const SearchContext = require("../search_context.js");
const becca = require('../../../becca/becca.js');
const beccaService = require('../../../becca/becca_service.js');
const utils = require('../../utils.js');
const log = require('../../log.js');

function loadNeededInfoFromDatabase() {
    const sql = require('../../sql.js');

    for (const noteId in becca.notes) {
        becca.notes[noteId].contentSize = 0;
        becca.notes[noteId].noteSize = 0;
        becca.notes[noteId].revisionCount = 0;
    }

    const noteContentLengths = sql.getRows(`
        SELECT 
            noteId, 
            LENGTH(content) AS length 
        FROM notes
             JOIN note_contents USING(noteId) 
        WHERE notes.isDeleted = 0`);

    for (const {noteId, length} of noteContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note ${noteId} not found in becca.`);
            continue;
        }

        becca.notes[noteId].contentSize = length;
        becca.notes[noteId].noteSize = length;
    }

    const noteRevisionContentLengths = sql.getRows(`
        SELECT 
            noteId, 
            LENGTH(content) AS length 
        FROM notes
             JOIN note_revisions USING(noteId) 
             JOIN note_revision_contents USING(noteRevisionId) 
        WHERE notes.isDeleted = 0`);

    for (const {noteId, length} of noteRevisionContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note ${noteId} not found in becca.`);
            continue;
        }

        becca.notes[noteId].noteSize += length;
        becca.notes[noteId].revisionCount++;
    }
}

/**
 * @param {Expression} expression
 * @param {SearchContext} searchContext
 * @return {SearchResult[]}
 */
function findResultsWithExpression(expression, searchContext) {
    let allNotes = Object.values(becca.notes);

    if (searchContext.dbLoadNeeded) {
        loadNeededInfoFromDatabase();
    }

    // in the process of loading data sometimes we create "skeleton" note instances which are expected to be filled later
    // in case of inconsistent data this might not work and search will then crash on these
    allNotes = allNotes.filter(note => note.type !== undefined);

    const allNoteSet = new NoteSet(allNotes);

    const executionContext = {
        noteIdToNotePath: {}
    };

    const noteSet = expression.execute(allNoteSet, executionContext);

    const searchResults = noteSet.notes
        .map(note => new SearchResult(
            executionContext.noteIdToNotePath[note.noteId] || beccaService.getSomePath(note)
        ));

    for (const res of searchResults) {
        res.computeScore(searchContext.highlightedTokens);
    }

    if (!noteSet.sorted) {
        searchResults.sort((a, b) => {
            if (a.score > b.score) {
                return -1;
            } else if (a.score < b.score) {
                return 1;
            }

            // if score does not decide then sort results by depth of the note.
            // This is based on the assumption that more important results are closer to the note root.
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

    if (searchContext.debug) {
        log.info(`Fulltext tokens: ` + JSON.stringify(fulltextTokens));
        log.info(`Expression tokens: ` + JSON.stringify(structuredExpressionTokens, null, 4));
        log.info("Expression tree: " + JSON.stringify(expression, null, 4));
    }

    return expression;
}

/**
 * @param {string} query
 * @return {Note[]}
 */
function findNotes(query) {
    const searchResults = findResultsWithQuery(query, new SearchContext());

    return searchResults.map(sr => becca.notes[sr.noteId]);
}

/**
 * @param {string} query
 * @param {SearchContext} searchContext
 * @return {SearchResult[]}
 */
function findResultsWithQuery(query, searchContext) {
    query = query || "";
    searchContext.originalQuery = query;

    const expression = parseQueryToExpression(query, searchContext);

    if (!expression) {
        return [];
    }

    return findResultsWithExpression(expression, searchContext);
}

function searchTrimmedNotes(query, searchContext) {
    const allSearchResults = findResultsWithQuery(query, searchContext);
    const trimmedSearchResults = allSearchResults.slice(0, 200);

    return {
        count: allSearchResults.length,
        results: trimmedSearchResults
    };
}

function searchNotesForAutocomplete(query) {
    const searchContext = new SearchContext({
        fastSearch: true,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: true
    });

    const {results} = searchTrimmedNotes(query, searchContext);

    highlightSearchResults(results, searchContext.highlightedTokens);

    return results.map(result => {
        return {
            notePath: result.notePath,
            noteTitle: beccaService.getNoteTitle(result.noteId),
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
    // < and > are used for marking <small> and </small>
    highlightedTokens = highlightedTokens.map(token => token.replace('/[<\{\}]/g', ''));

    // sort by the longest so we first highlight longest matches
    highlightedTokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of searchResults) {
        const note = becca.notes[result.noteId];

        result.highlightedNotePathTitle = result.notePathTitle.replace('/[<\{\}]/g', '');

        if (highlightedTokens.find(token => note.type.includes(token))) {
            result.highlightedNotePathTitle += ` "type: ${note.type}'`;
        }

        if (highlightedTokens.find(token => note.mime.includes(token))) {
            result.highlightedNotePathTitle += ` "mime: ${note.mime}'`;
        }

        for (const attr of note.getAttributes()) {
            if (highlightedTokens.find(token => attr.name.toLowerCase().includes(token)
                || attr.value.toLowerCase().includes(token))) {

                result.highlightedNotePathTitle += ` "${formatAttribute(attr)}'`;
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
            .replace(/"/g, "<small>")
            .replace(/'/g, "</small>")
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
    findResultsWithQuery,
    findNotes
};
