"use strict";

const protectedSessionService = require('../../services/protected_session');
const repository = require('../../services/repository');
const utils = require('../../services/utils');
const noteRevisionService = require('../../services/note_revisions');
const tmp = require('tmp');
const fs = require('fs');

function updateFile(req) {
    const {noteId} = req.params;
    const file = req.file;

    const note = repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    noteRevisionService.createNoteRevision(note);

    note.mime = file.mimetype.toLowerCase();
    note.save();

    note.setContent(file.buffer);

    note.setLabel('originalFileName', file.originalname);

    noteRevisionService.protectNoteRevisions(note);

    return {
        uploaded: true
    };
}

function getFilename(note) {
    // (one) reason we're not using the originFileName (available as label) is that it's not
    // available for older note revisions and thus would be inconsistent
    return utils.formatDownloadTitle(note.title, note.type, note.mime);
}

function downloadNoteFile(noteId, res, contentDisposition = true) {
    const note = repository.getNote(noteId);

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (note.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    if (contentDisposition) {
        const filename = getFilename(note);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    }

    res.setHeader('Content-Type', note.mime);

    res.send(note.getContent());
}

function downloadFile(req, res) {
    const noteId = req.params.noteId;

    return downloadNoteFile(noteId, res);
}

function openFile(req, res) {
    const noteId = req.params.noteId;

    return downloadNoteFile(noteId, res, false);
}

function saveToTmpDir(req) {
    const noteId = req.params.noteId;

    const note = repository.getNote(noteId);

    if (!note) {
        return [404,`Note ${noteId} doesn't exist.`];
    }

    const tmpObj = tmp.fileSync({postfix: getFilename(note)});

    fs.writeSync(tmpObj.fd, note.getContent());
    fs.closeSync(tmpObj.fd);

    return {
        tmpFilePath: tmpObj.name
    };
}

module.exports = {
    updateFile,
    openFile,
    downloadFile,
    downloadNoteFile,
    saveToTmpDir
};
