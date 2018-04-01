"use strict";

const utils = require('./utils');
const data_encryption = require('./data_encryption');
const dataKeyMap = {};
const cls = require('./cls');

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
        note.title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.noteId), note.title);
    }

    if (note.content) {
        const contentIv = data_encryption.noteContentIv(note.noteId);

        if (note.type === 'file') {
            note.content = data_encryption.decrypt(dataKey, contentIv, note.content);
        }
        else {
            note.content = data_encryption.decryptString(dataKey, contentIv, note.content);
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
        hist.title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(hist.noteRevisionId), hist.title);
    }

    if (hist.content) {
        hist.content = data_encryption.decryptString(dataKey, data_encryption.noteContentIv(hist.noteRevisionId), hist.content);
    }
}

function encryptNote(note) {
    const dataKey = getDataKey();

    note.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(note.noteId), note.title);
    note.content = data_encryption.encrypt(dataKey, data_encryption.noteContentIv(note.noteId), note.content);
}

function encryptNoteRevision(revision) {
    const dataKey = getDataKey();

    revision.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(revision.noteRevisionId), revision.title);
    revision.content = data_encryption.encrypt(dataKey, data_encryption.noteContentIv(revision.noteRevisionId), revision.content);
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