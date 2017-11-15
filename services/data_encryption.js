"use strict";

const utils = require('./utils');
const aesjs = require('./aes');
const crypto = require('crypto');

function getProtectedSessionId(req) {
    return req.headers['x-protected-session-id'];
}

function getDataAes(dataKey) {
    return new aesjs.ModeOfOperation.ctr(dataKey, new aesjs.Counter(5));
}

function decrypt(dataKey, encryptedBase64) {
    if (!dataKey) {
        return "[protected]";
    }

    const aes = getDataAes(dataKey);

    const encryptedBytes = utils.fromBase64(encryptedBase64);

    const decryptedBytes = aes.decrypt(encryptedBytes);

    const digest = decryptedBytes.slice(0, 4);
    const payload = decryptedBytes.slice(4);

    const hashArray = sha256Array(payload);

    const computedDigest = hashArray.slice(0, 4);

    if (!arraysIdentical(digest, computedDigest)) {
        return false;
    }

    return aesjs.utils.utf8.fromBytes(payload);
}

function encrypt(dataKey, plainText) {
    if (!dataKey) {
        throw new Error("No data key!");
    }

    const aes = getDataAes(dataKey);

    const payload = Array.from(aesjs.utils.utf8.toBytes(plainText));
    const digest = sha256Array(payload).slice(0, 4);

    const digestWithPayload = digest.concat(payload);

    const encryptedBytes = aes.encrypt(digestWithPayload);

    return utils.toBase64(encryptedBytes);
}

function sha256Array(content) {
    return crypto.createHash('sha256').update(content).digest();
}

function arraysIdentical(a, b) {
    let i = a.length;
    if (i !== b.length) return false;
    while (i--) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

module.exports = {
    getProtectedSessionId,
    decrypt,
    encrypt
};