"use strict";

const noteService = require('../../services/notes');
const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache');
const log = require('../../services/log');
const scriptService = require('../../services/script');
const searchService = require('../../services/search');

async function searchNotes(req) {
    const noteIds = await searchService.searchForNoteIds(req.params.searchString);

    return noteIds.map(noteCacheService.getNotePath).filter(res => !!res);
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

async function searchFromNote(req) {
    const note = await repository.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.type !== 'search') {
        return [400, '`Note ${req.params.noteId} is not search note.`']
    }

    const json = await note.getJsonContent();

    if (!json || !json.searchString) {
        return [];
    }

    let noteIds;

    if (json.searchString.startsWith('=')) {
        const relationName = json.searchString.substr(1).trim();

        noteIds = await searchFromRelation(note, relationName);
    }
    else {
        noteIds = searchService.searchForNoteIds(json.searchString);
    }

    // we won't return search note's own noteId
    noteIds = noteIds.filter(noteId => noteId !== note.noteId);

    return noteIds.map(noteCacheService.getNotePath).filter(res => !!res);
}

async function searchFromRelation(note, relationName) {
    const scriptNote = await note.getRelationTarget(relationName);

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

module.exports = {
    searchNotes,
    saveSearchToNote,
    searchFromNote
};