"use strict";

const noteService = require('../../services/notes');
const protectedSessionService = require('../../services/protected_session');
const repository = require('../../services/repository');
const utils = require('../../services/utils');
const noteRevisionService = require('../../services/note_revisions');

async function updateFile(req) {
    const {noteId} = req.params;
    const file = req.file;

    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    await noteRevisionService.createNoteRevision(note);

    note.mime = file.mimetype.toLowerCase();

    await note.setContent(file.buffer);

    await note.setLabel('originalFileName', file.originalname);

    await noteRevisionService.protectNoteRevisions(note);

    return {
        uploaded: true
    };
}

async function downloadNoteFile(noteId, res) {
    const note = await repository.getNote(noteId);

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    // (one) reason we're not using the originFileName (available as label) is that it's not
    // available for older note revisions and thus would be inconsistent
    res.setHeader('Content-Disposition', utils.getContentDisposition(note.title || "untitled"));
    res.setHeader('Content-Type', note.mime);

    res.send(await note.getContent());
}

async function downloadFile(req, res) {
    const noteId = req.params.noteId;

    return await downloadNoteFile(noteId, res);

}

module.exports = {
    updateFile,
    downloadFile,
    downloadNoteFile
};