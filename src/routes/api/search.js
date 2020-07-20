"use strict";

const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache/note_cache.js');
const log = require('../../services/log');
const scriptService = require('../../services/script');
const searchService = require('../../services/search/services/search.js');

function searchNotes(req) {
    const {count, results} = searchService.searchTrimmedNotes(req.params.searchString);

    try {
        return {
            success: true,
            count,
            results
        }
    }
    catch {
        return {
            success: false
        }
    }
}

function searchFromNote(req) {
    const note = repository.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        return [400, `Note ${req.params.noteId} is deleted.`];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not search note.`]
    }

    const json = note.getJsonContent();

    if (!json || !json.searchString) {
        return [];
    }

    let noteIds;

    try {
        if (json.searchString.startsWith('=')) {
            const relationName = json.searchString.substr(1).trim();

            noteIds = searchFromRelation(note, relationName);
        } else {
            noteIds = searchService.searchForNoteIds(json.searchString);
        }
    }
    catch (e) {
        log.error(`Search failed for note ${note.noteId}: ` + e.message + ": " + e.stack);

        throw new Error("Search failed, see logs for details.");
    }

    // we won't return search note's own noteId
    noteIds = noteIds.filter(noteId => noteId !== note.noteId);

    if (noteIds.length > 200) {
        noteIds = noteIds.slice(0, 200);
    }

    return noteIds.map(noteCacheService.getNotePath).filter(res => !!res);
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

    if (!note.isContentAvailable) {
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

function getRelatedNotes(req) {
    const attr = req.body;

    const matchingNameAndValue = searchService.searchNotes(formatAttrForSearch(attr, true));
    const matchingName = searchService.searchNotes(formatAttrForSearch(attr, false));

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
    searchNotes,
    searchFromNote,
    getRelatedNotes
};
