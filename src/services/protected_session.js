"use strict";

const utils = require('./utils');
const dataEncryptionService = require('./data_encryption');
const cls = require('./cls');

const dataKeyMap = {};

function setDataKey(decryptedDataKey) {
    const protectedSessionId = utils.randomSecureToken(32);

    dataKeyMap[protectedSessionId] = Array.from(decryptedDataKey); // can't store buffer in session

    return protectedSessionId;
}

function setProtectedSessionId(req) {
    cls.namespace.set('protectedSessionId', req.headers['trilium-protected-session-id']);
}

function getProtectedSessionId() {
    return cls.namespace.get('protectedSessionId');
}

function getDataKey() {
    const protectedSessionId = getProtectedSessionId();

    return dataKeyMap[protectedSessionId];
}

function isProtectedSessionAvailable() {
    const protectedSessionId = getProtectedSessionId();

    return !!dataKeyMap[protectedSessionId];
}

function decryptNoteTitle(noteId, encryptedTitle) {
    const dataKey = getDataKey();

    try {
        return dataEncryptionService.decryptString(dataKey, encryptedTitle);
    }
    catch (e) {
        e.message = `Cannot decrypt note title for noteId=${noteId}: ` + e.message;
        throw e;
    }
}

function decryptNote(note) {
    if (!note.isProtected) {
        return;
    }

    if (note.title) {
        note.title = decryptNoteTitle(note.noteId, note.title);
    }
}

function decryptNoteContent(noteContent) {
    if (!noteContent.isProtected) {
        return;
    }

    try {
        noteContent.content = dataEncryptionService.decrypt(getDataKey(), noteContent.content);
    }
    catch (e) {
        e.message = `Cannot decrypt note content for noteContentId=${noteContent.noteContentId}: ` + e.message;
        throw e;
    }
}

function decryptNotes(notes) {
    for (const note of notes) {
        decryptNote(note);
    }
}

function decryptNoteRevision(hist) {
    const dataKey = getDataKey();

    if (!hist.isProtected) {
        return;
    }

    if (hist.title) {
        hist.title = dataEncryptionService.decryptString(dataKey, hist.title);
    }

    if (hist.content) {
        hist.content = dataEncryptionService.decryptString(dataKey, hist.content);
    }
}

function encryptNote(note) {
    note.title = dataEncryptionService.encrypt(getDataKey(), note.title);
}

function encryptNoteContent(noteContent) {
    noteContent.content = dataEncryptionService.encrypt(getDataKey(), noteContent.content);
}

function encryptNoteRevision(revision) {
    const dataKey = getDataKey();

    revision.title = dataEncryptionService.encrypt(dataKey, revision.title);
    revision.content = dataEncryptionService.encrypt(dataKey, revision.content);
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable,
    decryptNoteTitle,
    decryptNote,
    decryptNoteContent,
    decryptNotes,
    decryptNoteRevision,
    encryptNote,
    encryptNoteContent,
    encryptNoteRevision,
    setProtectedSessionId
};