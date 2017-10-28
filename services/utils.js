"use strict";

const crypto = require('crypto');

function newNoteId() {
    return randomString(12);
}

const ALPHA_NUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomString(length) {
    let result = '';

    for (let i = length; i > 0; --i) {
        result += ALPHA_NUMERIC[Math.floor(Math.random() * ALPHA_NUMERIC.length)];
    }

    return result;
}

function randomSecureToken(bytes = 32) {
    crypto.randomBytes(bytes).toString('base64');
}

function nowTimestamp() {
    return Math.floor(Date.now() / 1000);
}

function toBase64(plainText) {
    return Buffer.from(plainText).toString('base64');
}

function fromBase64(encodedText) {
    return Buffer.from(encodedText, 'base64');
}

module.exports = {
    randomSecureToken,
    randomString,
    nowTimestamp,
    newNoteId,
    toBase64,
    fromBase64
};