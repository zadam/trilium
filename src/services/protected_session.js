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
    cls.namespace.set('protectedSessionId', req.cookies.protectedSessionId);
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

function decryptNoteContent(note) {
    try {
        if (note.content != null) {
            note.content = dataEncryptionService.decrypt(getDataKey(), note.content);
        }
    }
    catch (e) {
        e.message = `Cannot decrypt content for noteId=${note.noteId}: ` + e.message;
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

    try {
        if (hist.title) {
            hist.title = dataEncryptionService.decryptString(dataKey, hist.title.toString());
        }

        if (hist.content) {
            hist.content = dataEncryptionService.decryptString(dataKey, hist.content.toString());
        }
    }
    catch (e) {
        throw new Error(`Decryption failed for note ${hist.noteId}, revision ${hist.noteRevisionId}: ` + e.message + " " + e.stack);
    }
}

function encryptNote(note) {
    note.title = dataEncryptionService.encrypt(getDataKey(), note.title);
}

function encryptNoteContent(note) {
    note.content = dataEncryptionService.encrypt(getDataKey(), note.content);
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