"use strict";

const crypto = require('crypto');
const randtoken = require('rand-token').generator({source: 'crypto'});
const unescape = require('unescape');

function newEntityId() {
    return randomString(12);
}

function randomString(length) {
    return randtoken.generate(length);
}

function randomSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
}

function nowDate() {
    return dateStr(new Date());
}

function localDate() {
    const date = new Date();

    return date.getFullYear() + "-"
        + (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + "-"
        + (date.getDate() < 10 ? "0" : "") + date.getDate();
}

function dateStr(date) {
    return date.toISOString();
}

/**
 * @param str - needs to be in the ISO 8601 format "YYYY-MM-DDTHH:MM:SS.sssZ" format as outputted by dateStr().
 *              also is assumed to be GMT time (as indicated by the "Z" at the end), *not* local time
 */
function parseDateTime(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error("Can't parse date from " + str + ": " + e.stack);
    }
}

function parseDate(str) {
    const datePart = str.substr(0, 10);

    return parseDateTime(datePart + "T12:00:00.000Z");
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

function hash(text) {
    return crypto.createHash('sha1').update(text).digest('base64');
}

function isEmptyOrWhitespace(str) {
    return str === null || str.match(/^ *$/) !== null;
}

function getDateTimeForFile() {
    return new Date().toISOString().substr(0, 19).replace(/:/g, '');
}

function sanitizeSql(str) {
    // should be improved or usage eliminated
    return str.replace(/'/g, "\\'");
}

function assertArguments() {
    for (const i in arguments) {
        if (!arguments[i]) {
            throw new Error(`Argument idx#${i} should not be falsy: ${arguments[i]}`);
        }
    }
}

async function stopWatch(what, func) {
    const start = new Date();

    const ret = await func();

    const tookMs = new Date().getTime() - start.getTime();

    console.log(`${what} took ${tookMs}ms`);

    return ret;
}

function unescapeHtml(str) {
    return unescape(str);
}

function toObject(array, fn) {
    const obj = {};

    for (const item of array) {
        const ret = fn(item);

        obj[ret[0]] = ret[1];
    }

    return obj;
}

module.exports = {
    randomSecureToken,
    randomString,
    nowDate,
    localDate,
    dateStr,
    parseDate,
    parseDateTime,
    newEntityId,
    toBase64,
    fromBase64,
    hmac,
    isElectron,
    hash,
    isEmptyOrWhitespace,
    getDateTimeForFile,
    sanitizeSql,
    assertArguments,
    stopWatch,
    unescapeHtml,
    toObject
};