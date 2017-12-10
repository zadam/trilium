"use strict";

const crypto = require('crypto');
const randtoken = require('rand-token').generator({source: 'crypto'});

function newNoteId() {
    return randomString(12);
}

function newNoteTreeId() {
    return randomString(12);
}

function newNoteHistoryId() {
    return randomString(12);
}

function randomString(length) {
    return randtoken.generate(length);
}

function randomSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
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

function hmac(secret, value) {
    const hmac = crypto.createHmac('sha256', Buffer.from(secret.toString(), 'ASCII'));
    hmac.update(value.toString());
    return hmac.digest('base64');
}

function isElectron() {
    return !!process.versions['electron'];
}

function formatDateTimeFromTS(timestamp) {
    const date = new Date(timestamp * 1000);

    return date.toISOString();
}

function formatTwoTimestamps(origTS, newTS) {
    return "orig: " + formatDateTimeFromTS(origTS) + ", new: " + formatDateTimeFromTS(newTS);
}

function hash(text) {
    return crypto.createHash('sha1').update(text).digest('base64');
}

function isEmptyOrWhitespace(str) {
    return str === null || str.match(/^ *$/) !== null;
}


module.exports = {
    randomSecureToken,
    randomString,
    nowTimestamp,
    newNoteId,
    newNoteTreeId,
    newNoteHistoryId,
    toBase64,
    fromBase64,
    hmac,
    isElectron,
    formatTwoTimestamps,
    hash,
    isEmptyOrWhitespace
};