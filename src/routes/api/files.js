"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const log = require('../../services/log');
const noteRevisionService = require('../../services/note_revisions');
const tmp = require('tmp');
const fs = require('fs');
const { Readable } = require('stream');
const chokidar = require('chokidar');
const ws = require('../../services/ws');
const becca = require("../../becca/becca");

function updateFile(req) {
    const {noteId} = req.params;
    const file = req.file;

    const note = becca.getNote(noteId);

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
    const note = becca.getNote(noteId);

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

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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

function fileContentProvider(req) {
    // Read file name from route params.
    const note = becca.getNote(req.params.noteId);
    const fileName = getFilename(note);
    let content = note.getContent();

    if (typeof content === "string") {
       content = Buffer.from(content, 'utf8');
    }

    const totalSize = content.byteLength;
    const mimeType = note.mime;

    const getStream = range => {
        if (!range) {
            // Request if for complete content.
            return Readable.from(content);
        }
        // Partial content request.
        const { start, end } = range;

        return Readable.from(content.slice(start, end + 1));
    }

    return {
        fileName,
        totalSize,
        mimeType,
        getStream
    };
}

function saveToTmpDir(req) {
    const noteId = req.params.noteId;

    const note = becca.getNote(noteId);

    if (!note) {
        return [404,`Note ${noteId} doesn't exist.`];
    }

    const tmpObj = tmp.fileSync({postfix: getFilename(note)});

    fs.writeSync(tmpObj.fd, note.getContent());
    fs.closeSync(tmpObj.fd);

    log.info(`Saved temporary file for note ${noteId} into ${tmpObj.name}`);

    if (utils.isElectron()) {
        chokidar.watch(tmpObj.name).on('change', (path, stats) => {
            ws.sendMessageToAllClients({
                type: 'openedFileUpdated',
                noteId: noteId,
                lastModifiedMs: stats.atimeMs,
                filePath: tmpObj.name
            });
        });
    }

    return {
        tmpFilePath: tmpObj.name
    };
}

module.exports = {
    updateFile,
    openFile,
    fileContentProvider,
    downloadFile,
    downloadNoteFile,
    saveToTmpDir
};
