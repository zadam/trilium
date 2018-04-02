"use strict";

const noteService = require('../../services/notes');
const treeService = require('../../services/tree');
const repository = require('../../services/repository');

async function getNote(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, "Note " + noteId + " has not been found."];
    }

    if (note.type === 'file') {
        // no need to transfer (potentially large) file payload for this request
        note.content = null;
    }

    return note;
}

async function createNote(req) {
    const parentNoteId = req.params.parentNoteId;
    const newNote = req.body;

    const { note, branch } = await noteService.createNewNote(parentNoteId, newNote, req);

    return {
        note,
        branch
    };
}

async function updateNote(req) {
    const note = req.body;
    const noteId = req.params.noteId;

    await noteService.updateNote(noteId, note);
}

async function sortNotes(req) {
    const noteId = req.params.noteId;

    await treeService.sortNotesAlphabetically(noteId);
}

async function protectBranch(req) {
    const noteId = req.params.noteId;
    const note = repository.getNote(noteId);
    const protect = !!parseInt(req.params.isProtected);

    await noteService.protectNoteRecursively(note, protect);
}

async function setNoteTypeMime(req) {
    const [noteId, type, mime] = req.params;

    const note = await repository.getNote(noteId);
    note.type = type;
    note.mime = mime;
    await note.save();
}

module.exports = {
    getNote,
    updateNote,
    createNote,
    sortNotes,
    protectBranch,
    setNoteTypeMime
};