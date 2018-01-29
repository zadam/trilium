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
        note.content = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(note.noteId), note.content);
    }
}

function decryptNotes(dataKey, notes) {
    dataKey = getDataKey(dataKey);

    for (const note of notes) {
        decryptNote(dataKey, note);
    }
}

function decryptNoteHistoryRow(dataKey, hist) {
    dataKey = getDataKey(dataKey);

    if (!hist.isProtected) {
        return;
    }

    if (hist.title) {
        hist.title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(hist.noteRevisionId), hist.title);
    }

    if (hist.content) {
        hist.content = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(hist.noteRevisionId), hist.content);
    }
}

function decryptNoteHistoryRows(dataKey, historyRows) {
    dataKey = getDataKey(dataKey);

    for (const hist of historyRows) {
        decryptNoteHistoryRow(dataKey, hist);
    }
}

function encryptNote(dataKey, note) {
    dataKey = getDataKey(dataKey);

    note.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(note.noteId), note.title);
    note.content = data_encryption.encrypt(dataKey, data_encryption.noteTextIv(note.noteId), note.content);
}

function encryptNoteHistoryRow(dataKey, history) {
    dataKey = getDataKey(dataKey);

    history.title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(history.noteRevisionId), history.title);
    history.content = data_encryption.encrypt(dataKey, data_encryption.noteTextIv(history.noteRevisionId), history.content);
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable,
    decryptNote,
    decryptNotes,
    decryptNoteHistoryRow,
    decryptNoteHistoryRows,
    encryptNote,
    encryptNoteHistoryRow
};