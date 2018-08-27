"use strict";

const crypto = require('crypto');
const log = require('./log');

function arraysIdentical(a, b) {
    let i = a.length;
    if (i !== b.length) return false;
    while (i--) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function shaArray(content) {
    // we use this as simple checksum and don't rely on its security so SHA-1 is good enough
    return crypto.createHash('sha1').update(content).digest();
}

function pad(data) {
    let padded = Array.from(data);

    if (data.length >= 16) {
        padded = padded.slice(0, 16);
    }
    else {
        padded = padded.concat(Array(16 - padded.length).fill(0));
    }

    return Buffer.from(padded);
}

function encrypt(key, iv, plainText) {
    if (!key) {
        throw new Error("No data key!");
    }

    const plainTextBuffer = Buffer.from(plainText);

    const cipher = crypto.createCipheriv('aes-128-cbc', pad(key), pad(iv));

    const digest = shaArray(plainTextBuffer).slice(0, 4);

    const digestWithPayload = Buffer.concat([digest, plainTextBuffer]);

    const encryptedData = Buffer.concat([cipher.update(digestWithPayload), cipher.final()]);

    return encryptedData.toString('base64');
}

function decrypt(key, iv, cipherText) {
    if (!key) {
        return "[protected]";
    }

    const decipher = crypto.createDecipheriv('aes-128-cbc', pad(key), pad(iv));

    const cipherTextBuffer = Buffer.from(cipherText, 'base64');
    const decryptedBytes = Buffer.concat([decipher.update(cipherTextBuffer), decipher.final()]);

    const digest = decryptedBytes.slice(0, 4);
    const payload = decryptedBytes.slice(4);

    const computedDigest = shaArray(payload).slice(0, 4);

    if (!arraysIdentical(digest, computedDigest)) {
        return false;
    }

    return payload;
}

function decryptString(dataKey, iv, cipherText) {
    const buffer = decrypt(dataKey, iv, cipherText);

    const str = buffer.toString('utf-8');

    if (str === 'false') {
        log.error("Could not decrypt string. Buffer: " + buffer);

        throw new Error("Could not decrypt string.");
    }

    return str;
}

function noteTitleIv(iv) {
    if (!iv) {
        throw new Error("Empty iv!");
    }

    return "0" + iv;
}

function noteContentIv(iv) {
    if (!iv) {
        throw new Error("Empty iv!");
    }

    return "1" + iv;
}

module.exports = {
    encrypt,
    decrypt,
    decryptString,
    noteTitleIv,
    noteContentIv
};