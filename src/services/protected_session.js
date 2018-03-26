"use strict";

const utils = require('./utils');
const data_encryption = require('./data_encryption');
const session = {};

function setDataKey(req, decryptedDataKey) {
    session.decryptedDataKey = Array.from(decryptedDataKey); // can't store buffer in session
    session.protectedSessionId = utils.randomSecureToken(32);

    return session.protectedSessionId;
}

function getProtectedSessionId(req) {
    return req.headers.protected_session_id;
}

/**
 * @param obj - can be either array, in that case it's considered to be already dataKey and we just return it
 *              if it's not a array, we consider it a request object and try to pull dataKey based on the session id header
 */
function getDataKey(obj) {
    if (!obj || obj.constructor.name === 'Array') {
        return obj;
    }

    const protectedSessionId = getProtectedSessionId(obj);

    return getDataKeyForProtectedSessionId(protectedSessionId);
}

function getDataKeyForProtectedSessionId(protectedSessionId) {
    if (protectedSessionId && session.protectedSessionId === protectedSessionId) {
        return session.decryptedDataKey;
    }
    else {
        return null;
    }
}

function isProtectedSessionAvailable(req) {
    const protectedSessionId = getProtectedSessionId(req);

    return protectedSessionId && session.protectedSessionId === protectedSessionId;
}

function decryptNote(dataKey, note) {
    dataKey = getDataKey(dataKey);

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

function decryptNotes(dataKey, notes) {
    dataKey = getDataKey(dataKey);

    for (const note of notes) {
        decryptNote(dataKey, note);
    }
}

function decryptNoteRevision(dataKey, hist) {
    dataKey = getDataKey(dataKey);

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

function decryptNoteRevisions(dataKey, noteRevisions) {
    dataKey = getDataKey(dataKey);

    for (const revision of noteRevisions) {
        decryptNoteRevision(dataKey, revision);
    }
}

function encryptNote(dataKey, note) {
    dataKey = getDataKey(dataKey);

    note.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(note.noteId), note.title);
    note.content = data_encryption.encrypt(dataKey, data_encryption.noteContentIv(note.noteId), note.content);
}

function encryptNoteRevision(dataKey, revision) {
    dataKey = getDataKey(dataKey);

    revision.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(revision.noteRevisionId), revision.title);
    revision.content = data_encryption.encrypt(dataKey, data_encryption.noteContentIv(revision.noteRevisionId), revision.content);
}

module.exports = {
    setDataKey,
    getDataKey,
    getDataKeyForProtectedSessionId,
    isProtectedSessionAvailable,
    decryptNote,
    decryptNotes,
    decryptNoteRevision,
    decryptNoteRevisions,
    encryptNote,
    encryptNoteRevision
};