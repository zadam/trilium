"use strict";

import normalizeString = require("normalize-strings");
import lex = require('./lex');
import handleParens = require('./handle_parens');
import parse = require('./parse');
import SearchResult = require('../search_result');
import SearchContext = require('../search_context');
import becca = require('../../../becca/becca');
import beccaService = require('../../../becca/becca_service');
import utils = require('../../utils');
import log = require('../../log');
import hoistedNoteService = require('../../hoisted_note');
import BNote = require("../../../becca/entities/bnote");
import BAttribute = require("../../../becca/entities/battribute");
import { SearchParams, TokenData } from "./types";
import Expression = require("../expressions/expression");
import sql = require("../../sql");

function searchFromNote(note: BNote) {
    let searchResultNoteIds;
    let highlightedTokens: string[];

    const searchScript = note.getRelationValue('searchScript');
    const searchString = note.getLabelValue('searchString') || "";
    let error = null;

    if (searchScript) {
        searchResultNoteIds = searchFromRelation(note, 'searchScript');
        highlightedTokens = [];
    } else {
        const searchContext = new SearchContext({
            fastSearch: note.hasLabel('fastSearch'),
            ancestorNoteId: note.getRelationValue('ancestor') || undefined,
            ancestorDepth: note.getLabelValue('ancestorDepth') || undefined,
            includeArchivedNotes: note.hasLabel('includeArchivedNotes'),
            orderBy: note.getLabelValue('orderBy') || undefined,
            orderDirection: note.getLabelValue('orderDirection') || undefined,
            limit: parseInt(note.getLabelValue('limit') || "0", 10),
            debug: note.hasLabel('debug'),
            fuzzyAttributeSearch: false
        });

        searchResultNoteIds = findResultsWithQuery(searchString, searchContext)
            .map(sr => sr.noteId);

        highlightedTokens = searchContext.highlightedTokens;
        error = searchContext.getError();
    }

    // we won't return search note's own noteId
    // also don't allow root since that would force infinite cycle
    return {
        searchResultNoteIds: searchResultNoteIds.filter(resultNoteId => !['root', note.noteId].includes(resultNoteId)),
        highlightedTokens,
        error: error
    };
}

function searchFromRelation(note: BNote, relationName: string) {
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

    const scriptService = require('../../script'); // TODO: to avoid circular dependency
    const result = scriptService.executeNote(scriptNote, {originEntity: note});

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

function loadNeededInfoFromDatabase() {
    /**
     * This complex structure is needed to calculate total occupied space by a note. Several object instances
     * (note, revisions, attachments) can point to a single blobId, and thus the blob size should count towards the total
     * only once.
     *
     * noteId => { blobId => blobSize }
     */
    const noteBlobs: Record<string, Record<string, number>> = {};

    type NoteContentLengthsRow = {
        noteId: string;
        blobId: string;
        length: number;
    };
    const noteContentLengths = sql.getRows<NoteContentLengthsRow>(`
        SELECT 
            noteId, 
            blobId,
            LENGTH(content) AS length 
        FROM notes
             JOIN blobs USING(blobId) 
        WHERE notes.isDeleted = 0`);

    for (const {noteId, blobId, length} of noteContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note '${noteId}' not found in becca.`);
            continue;
        }

        becca.notes[noteId].contentSize = length;
        becca.notes[noteId].revisionCount = 0;

        noteBlobs[noteId] = { [blobId]: length };
    }

    type AttachmentContentLengthsRow = {
        noteId: string;
        blobId: string;
        length: number;
    };
    const attachmentContentLengths = sql.getRows<AttachmentContentLengthsRow>(`
        SELECT
            ownerId AS noteId,
            attachments.blobId,
            LENGTH(content) AS length
        FROM attachments
            JOIN notes ON attachments.ownerId = notes.noteId
            JOIN blobs ON attachments.blobId = blobs.blobId
        WHERE attachments.isDeleted = 0 
            AND notes.isDeleted = 0`);

    for (const {noteId, blobId, length} of attachmentContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note '${noteId}' not found in becca.`);
            continue;
        }

        if (!(noteId in noteBlobs)) {
            log.error(`Did not find a '${noteId}' in the noteBlobs.`);
            continue;
        }

        noteBlobs[noteId][blobId] = length;
    }

    for (const noteId in noteBlobs) {
        becca.notes[noteId].contentAndAttachmentsSize = Object.values(noteBlobs[noteId]).reduce((acc, size) => acc + size, 0);
    }

    type RevisionRow = {
        noteId: string;
        blobId: string;
        length: number;
        isNoteRevision: true;
    };
    const revisionContentLengths = sql.getRows<RevisionRow>(`
            SELECT 
                noteId, 
                revisions.blobId,
                LENGTH(content) AS length,
                1 AS isNoteRevision
            FROM notes
                JOIN revisions USING(noteId) 
                JOIN blobs ON revisions.blobId = blobs.blobId
            WHERE notes.isDeleted = 0
        UNION ALL
            SELECT
                noteId,
                revisions.blobId,
                LENGTH(content) AS length,
                0 AS isNoteRevision -- it's attachment not counting towards revision count
            FROM notes
                JOIN revisions USING(noteId)
                JOIN attachments ON attachments.ownerId = revisions.revisionId
                JOIN blobs ON attachments.blobId = blobs.blobId
            WHERE notes.isDeleted = 0`);

    for (const {noteId, blobId, length, isNoteRevision} of revisionContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note '${noteId}' not found in becca.`);
            continue;
        }

        if (!(noteId in noteBlobs)) {
            log.error(`Did not find a '${noteId}' in the noteBlobs.`);
            continue;
        }

        noteBlobs[noteId][blobId] = length;

        if (isNoteRevision) { 
            const noteRevision = becca.notes[noteId];
            if (noteRevision && noteRevision.revisionCount) {
                noteRevision.revisionCount++;
            }
        }
    }

    for (const noteId in noteBlobs) {
        becca.notes[noteId].contentAndAttachmentsAndRevisionsSize = Object.values(noteBlobs[noteId]).reduce((acc, size) => acc + size, 0);
    }
}

function findResultsWithExpression(expression: Expression, searchContext: SearchContext): SearchResult[] {
    if (searchContext.dbLoadNeeded) {
        loadNeededInfoFromDatabase();
    }

    const allNoteSet = becca.getAllNoteSet();

    const noteIdToNotePath: Record<string, string[]> = {};
    const executionContext = {
        noteIdToNotePath
    };

    const noteSet = expression.execute(allNoteSet, executionContext, searchContext);

    const searchResults = noteSet.notes
        .map(note => {
            const notePathArray = executionContext.noteIdToNotePath[note.noteId] || note.getBestNotePath();

            if (!notePathArray) {
                throw new Error(`Can't find note path for note ${JSON.stringify(note.getPojo())}`);
            }

            return new SearchResult(notePathArray);
        });

    for (const res of searchResults) {
        res.computeScore(searchContext.fulltextQuery, searchContext.highlightedTokens);
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

function parseQueryToExpression(query: string, searchContext: SearchContext) {
    const {fulltextQuery, fulltextTokens, expressionTokens} = lex(query);
    searchContext.fulltextQuery = fulltextQuery;

    let structuredExpressionTokens: (TokenData | TokenData[])[];

    try {
        structuredExpressionTokens = handleParens(expressionTokens);
    }
    catch (e: any) {
        structuredExpressionTokens = [];
        searchContext.addError(e.message);
    }

    const expression = parse({
        fulltextTokens,
        expressionTokens: structuredExpressionTokens,
        searchContext,
        originalQuery: query
    });

    if (searchContext.debug) {
        searchContext.debugInfo = {
            fulltextTokens,
            structuredExpressionTokens,
            expression
        };

        log.info(`Search debug: ${JSON.stringify(searchContext.debugInfo, null, 4)}`);
    }

    return expression;
}

function searchNotes(query: string, params: SearchParams = {}): BNote[] {
    const searchResults = findResultsWithQuery(query, new SearchContext(params));

    return searchResults.map(sr => becca.notes[sr.noteId]);
}

function findResultsWithQuery(query: string, searchContext: SearchContext): SearchResult[] {
    query = query || "";
    searchContext.originalQuery = query;

    const expression = parseQueryToExpression(query, searchContext);

    if (!expression) {
        return [];
    }

    return findResultsWithExpression(expression, searchContext);
}

function findFirstNoteWithQuery(query: string, searchContext: SearchContext): BNote | null {
    const searchResults = findResultsWithQuery(query, searchContext);

    return searchResults.length > 0 ? becca.notes[searchResults[0].noteId] : null;
}

function searchNotesForAutocomplete(query: string) {
    const searchContext = new SearchContext({
        fastSearch: true,
        includeArchivedNotes: false,
        includeHiddenNotes: true,
        fuzzyAttributeSearch: true,
        ancestorNoteId: hoistedNoteService.isHoistedInHiddenSubtree()
            ? 'root'
            : hoistedNoteService.getHoistedNoteId()
    });

    const allSearchResults = findResultsWithQuery(query, searchContext);

    const trimmed = allSearchResults.slice(0, 200);

    highlightSearchResults(trimmed, searchContext.highlightedTokens);

    return trimmed.map(result => {
        return {
            notePath: result.notePath,
            noteTitle: beccaService.getNoteTitle(result.noteId),
            notePathTitle: result.notePathTitle,
            highlightedNotePathTitle: result.highlightedNotePathTitle
        };
    });
}

function highlightSearchResults(searchResults: SearchResult[], highlightedTokens: string[]) {
    highlightedTokens = Array.from(new Set(highlightedTokens));

    // we remove < signs because they can cause trouble in matching and overwriting existing highlighted chunks
    // which would make the resulting HTML string invalid.
    // { and } are used for marking <b> and </b> tag (to avoid matches on single 'b' character)
    // < and > are used for marking <small> and </small>
    highlightedTokens = highlightedTokens
        .map(token => token.replace('/[<\{\}]/g', ''))
        .filter(token => !!token?.trim());

    // sort by the longest, so we first highlight the longest matches
    highlightedTokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of searchResults) {
        const note = becca.notes[result.noteId];

        result.highlightedNotePathTitle = result.notePathTitle.replace(/[<{}]/g, '');

        if (highlightedTokens.find(token => note.type.includes(token))) {
            result.highlightedNotePathTitle += ` "type: ${note.type}'`;
        }

        if (highlightedTokens.find(token => note.mime.includes(token))) {
            result.highlightedNotePathTitle += ` "mime: ${note.mime}'`;
        }

        for (const attr of note.getAttributes()) {
            if (highlightedTokens.find(token => utils.normalize(attr.name).includes(token)
                || utils.normalize(attr.value).includes(token))) {

                result.highlightedNotePathTitle += ` "${formatAttribute(attr)}'`;
            }
        }
    }

    function wrapText(text: string, start: number, length: number, prefix: string, suffix: string) {
        return text.substring(0, start) + prefix + text.substr(start, length) + suffix + text.substring(start + length);
    }

    for (const token of highlightedTokens) {
        if (!token) {
            // Avoid empty tokens, which might cause an infinite loop.
            continue;
        }

        for (const result of searchResults) {
            // Reset token
            const tokenRegex = new RegExp(utils.escapeRegExp(token), "gi");
            let match;

            // Find all matches
            if (!result.highlightedNotePathTitle) { continue; }
            while ((match = tokenRegex.exec(normalizeString(result.highlightedNotePathTitle))) !== null) {
                result.highlightedNotePathTitle = wrapText(result.highlightedNotePathTitle, match.index, token.length, "{", "}");

                // 2 characters are added, so we need to adjust the index
                tokenRegex.lastIndex += 2;
            }
        }
    }

    for (const result of searchResults) {
        if (!result.highlightedNotePathTitle) { continue; }
        result.highlightedNotePathTitle = result.highlightedNotePathTitle
            .replace(/"/g, "<small>")
            .replace(/'/g, "</small>")
            .replace(/{/g, "<b>")
            .replace(/}/g, "</b>");
    }
}

function formatAttribute(attr: BAttribute) {
    if (attr.type === 'relation') {
        return `~${utils.escapeHtml(attr.name)}=…`;
    }
    else if (attr.type === 'label') {
        let label = `#${utils.escapeHtml(attr.name)}`;

        if (attr.value) {
            const val = /[^\w-]/.test(attr.value) ? `"${attr.value}"` : attr.value;

            label += `=${utils.escapeHtml(val)}`;
        }

        return label;
    }
}

export = {
    searchFromNote,
    searchNotesForAutocomplete,
    findResultsWithQuery,
    findFirstNoteWithQuery,
    searchNotes
};
