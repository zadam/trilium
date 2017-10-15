const crypto = require('crypto');

function randomToken(length) {
    return crypto.randomBytes(length).toString('base64');
}

function newNoteId() {
    return randomString(32, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
}

function randomString(length, chars) {
    let result = '';

    for (let i = length; i > 0; --i) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
}

function nowTimestamp() {
    return Date.now();
}

function toBase64(plainText) {
    return Buffer.from(plainText).toString('base64');
}

function fromBase64(encodedText) {
    return Buffer.from(encodedText, 'base64');
}

module.exports = {
    randomToken,
    nowTimestamp,
    newNoteId,
    toBase64,
    fromBase64
};