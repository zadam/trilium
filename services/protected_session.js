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

    if (!note.is_protected) {
        return;
    }

    if (note.note_title) {
        note.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
    }

    if (note.note_text) {
        note.note_text = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(note.note_id), note.note_text);
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

    if (!hist.is_protected) {
        return;
    }

    if (hist.note_title) {
        hist.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(hist.note_history_id), hist.note_title);
    }

    if (hist.note_text) {
        hist.note_text = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(hist.note_history_id), hist.note_text);
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

    note.note_title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
    note.note_text = data_encryption.encrypt(dataKey, data_encryption.noteTextIv(note.note_id), note.note_text);
}

function encryptNoteHistoryRow(dataKey, history) {
    dataKey = getDataKey(dataKey);

    history.note_title = data_encryption.encrypt(dataKey, data_encryption.noteTitleIv(history.note_history_id), history.note_title);
    history.note_text = data_encryption.encrypt(dataKey, data_encryption.noteTextIv(history.note_history_id), history.note_text);
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