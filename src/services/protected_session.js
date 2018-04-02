"use strict";

const utils = require('./utils');
const dataEncryptionService = require('./data_encryption');
const cls = require('./cls');

const dataKeyMap = {};

function setDataKey(req, decryptedDataKey) {
    const protectedSessionId = utils.randomSecureToken(32);

    dataKeyMap[protectedSessionId] = Array.from(decryptedDataKey); // can't store buffer in session

    return protectedSessionId;
}

function setProtectedSessionId(req) {
    cls.namespace.set('protectedSessionId', req.headers.protected_session_id);
}

function getProtectedSessionId() {
    return cls.namespace.get('protectedSessionId');
}

function getDataKey() {
    const protectedSessionId = getProtectedSessionId();

    return dataKeyMap[protectedSessionId];
}

function isProtectedSessionAvailable(req) {
    const protectedSessionId = getProtectedSessionId(req);

    return !!dataKeyMap[protectedSessionId];
}

function decryptNote(note) {
    const dataKey = getDataKey();

    if (!note.isProtected) {
        return;
    }

    if (note.title) {
        note.title = dataEncryptionService.decryptString(dataKey, dataEncryptionService.noteTitleIv(note.noteId), note.title);
    }

    if (note.content) {
        const contentIv = dataEncryptionService.noteContentIv(note.noteId);

        if (note.type === 'file') {
            note.content = dataEncryptionService.decrypt(dataKey, contentIv, note.content);
        }
        else {
            note.content = dataEncryptionService.decryptString(dataKey, contentIv, note.content);
        }
    }
}

function decryptNotes(notes) {
    const dataKey = getDataKey();

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
        hist.title = dataEncryptionService.decryptString(dataKey, dataEncryptionService.noteTitleIv(hist.noteRevisionId), hist.title);
    }

    if (hist.content) {
        hist.content = dataEncryptionService.decryptString(dataKey, dataEncryptionService.noteContentIv(hist.noteRevisionId), hist.content);
    }
}

function encryptNote(note) {
    const dataKey = getDataKey();

    note.title = dataEncryptionService.encrypt(dataKey, dataEncryptionService.noteTitleIv(note.noteId), note.title);
    note.content = dataEncryptionService.encrypt(dataKey, dataEncryptionService.noteContentIv(note.noteId), note.content);
}

function encryptNoteRevision(revision) {
    const dataKey = getDataKey();

    revision.title = dataEncryptionService.encrypt(dataKey, dataEncryptionService.noteTitleIv(revision.noteRevisionId), revision.title);
    revision.content = dataEncryptionService.encrypt(dataKey, dataEncryptionService.noteContentIv(revision.noteRevisionId), revision.content);
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable,
    decryptNote,
    decryptNotes,
    decryptNoteRevision,
    encryptNote,
    encryptNoteRevision,
    setProtectedSessionId
};