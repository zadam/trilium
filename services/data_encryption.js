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

function arraysIdentical(a, b) {
    let i = a.length;
    if (i !== b.length) return false;
    while (i--) {
        if (a[i] !== b[i]) return false;
    }
    return true;
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

function shaArray(content) {
    // we use this as simple checksum and don't rely on its security so SHA-1 is good enough
    return crypto.createHash('sha1').update(content).digest();
}

function sha256Array(content) {
    return crypto.createHash('sha256').update(content).digest();
}

function pad(data) {
    console.log("Before padding: ", data);

    let padded = Array.from(data);

    console.log("After arraying: ", padded);

    if (data.length >= 16) {
        padded = padded.slice(0, 16);
    }
    else {
        padded = padded.concat(Array(16 - padded.length).fill(0));
    }

    console.log("Before buffering: ", padded);

    return Buffer.from(padded);
}

function encryptCbc(dataKey, iv, plainText) {
    if (!dataKey) {
        throw new Error("No data key!");
    }

    const plainTextBuffer = Buffer.from(plainText);

    const cipher = crypto.createCipheriv('aes-128-cbc', pad(dataKey), pad(iv));

    const digest = shaArray(plainTextBuffer).slice(0, 4);

    const digestWithPayload = Buffer.concat([digest, plainTextBuffer]);

    const encryptedData = Buffer.concat([cipher.update(digestWithPayload), cipher.final()]);

    return encryptedData.toString('base64');
}

function decryptCbc(dataKey, iv, cipherText) {
    if (!dataKey) {
        return "[protected]";
    }

    console.log("Key: ", pad(dataKey));

    const decipher = crypto.createDecipheriv('aes-128-cbc', pad(dataKey), pad(iv));

    const cipherTextBuffer = Buffer.from(cipherText, 'base64');
    const decryptedBytes = Buffer.concat([decipher.update(cipherTextBuffer), decipher.final()]);

    console.log("decrypted: ", decryptedBytes);

    const digest = decryptedBytes.slice(0, 4);
    const payload = decryptedBytes.slice(4);

    console.log("payload: ", payload);

    const computedDigest = shaArray(payload).slice(0, 4);

    console.log("Hash arr: ", computedDigest);

    if (!arraysIdentical(digest, computedDigest)) {
        return false;
    }

    return payload;
}

function decryptCbcString(dataKey, iv, cipherText) {
    const buffer = decryptCbc(dataKey, iv, cipherText);

    return buffer.toString('utf-8');
}

function noteTitleIv(iv) {
    return "0" + iv;
}

function noteTextIv(iv) {
    return "1" + iv;
}

module.exports = {
    getProtectedSessionId,
    decrypt,
    encrypt,
    encryptCbc,
    decryptCbc,
    decryptCbcString,
    noteTitleIv,
    noteTextIv
};