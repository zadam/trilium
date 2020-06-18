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
    cls.set('protectedSessionId', req.cookies.protectedSessionId);
}

function getProtectedSessionId() {
    return cls.get('protectedSessionId');
}

function getDataKey() {
    const protectedSessionId = getProtectedSessionId();

    return dataKeyMap[protectedSessionId];
}

function isProtectedSessionAvailable() {
    const protectedSessionId = getProtectedSessionId();

    return !!dataKeyMap[protectedSessionId];
}

function decryptNotes(notes) {
    for (const note of notes) {
        if (note.isProtected) {
            note.title = decryptString(note.title);
        }
    }
}

function encrypt(plainText) {
    return dataEncryptionService.encrypt(getDataKey(), plainText);
}

function decrypt(cipherText) {
    return dataEncryptionService.decrypt(getDataKey(), cipherText);
}

function decryptString(cipherText) {
    return dataEncryptionService.decryptString(getDataKey(), cipherText);
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable,
    encrypt,
    decrypt,
    decryptString,
    decryptNotes,
    setProtectedSessionId
};
