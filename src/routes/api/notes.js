"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const utils = require('../../services/utils');
const protected_session = require('../../services/protected_session');
const tree = require('../../services/tree');
const sync_table = require('../../services/sync_table');
const wrap = require('express-promise-wrap').wrap;

async function getNote(req) {
    const noteId = req.params.noteId;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!note) {
        return [404, "Note " + noteId + " has not been found."];
    }

    protected_session.decryptNote(note);

    if (note.type === 'file') {
        // no need to transfer (potentially large) file payload for this request
        note.content = null;
    }

    return note;
}

async function createNote(req) {
    const parentNoteId = req.params.parentNoteId;
    const newNote = req.body;

    const { noteId, branchId, note } = await notes.createNewNote(parentNoteId, newNote, req);

    return {
        'noteId': noteId,
        'branchId': branchId,
        'note': note
    };
}

async function updateNote(req) {
    const note = req.body;
    const noteId = req.params.noteId;

    await notes.updateNote(noteId, note);
}

async function sortNotes(req) {
    const noteId = req.params.noteId;

    await tree.sortNotesAlphabetically(noteId);
}

async function protectBranch(req) {
    const noteId = req.params.noteId;
    const isProtected = !!parseInt(req.params.isProtected);

    await notes.protectNoteRecursively(noteId, isProtected);
}

async function setNoteTypeMime(req) {
    const noteId = req.params[0];
    const type = req.params[1];
    const mime = req.params[2];

    await sql.execute("UPDATE notes SET type = ?, mime = ?, dateModified = ? WHERE noteId = ?",
        [type, mime, utils.nowDate(), noteId]);

    await sync_table.addNoteSync(noteId);
}

module.exports = {
    getNote,
    updateNote,
    createNote,
    sortNotes,
    protectBranch,
    setNoteTypeMime
};