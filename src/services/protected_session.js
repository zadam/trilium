"use strict";

const log = require('./log');
const dataEncryptionService = require('./data_encryption');

let dataKey = null;

function setDataKey(decryptedDataKey) {
    dataKey = Array.from(decryptedDataKey);
}

function getDataKey() {
    return dataKey;
}

function resetDataKey() {
    dataKey = null;
}

function isProtectedSessionAvailable() {
    return !!dataKey;
}

function decryptNotes(notes) {
    try {
        for (const note of notes) {
            if (note.isProtected) {
                note.title = decryptString(note.title);
            }
        }
    }
    catch (e) {
        log.error(`Could not decrypt protected notes: ${e.message} ${e.stack}`);
    }
}

function encrypt(plainText) {
    if (plainText === null) {
        return null;
    }

    return dataEncryptionService.encrypt(getDataKey(), plainText);
}

function decrypt(cipherText) {
    if (cipherText === null) {
        return null;
    }

    return dataEncryptionService.decrypt(getDataKey(), cipherText);
}

function decryptString(cipherText) {
    return dataEncryptionService.decryptString(getDataKey(), cipherText);
}

module.exports = {
    setDataKey,
    resetDataKey,
    isProtectedSessionAvailable,
    encrypt,
    decrypt,
    decryptString,
    decryptNotes
};
