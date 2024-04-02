"use strict";

import crypto = require('crypto');
import log = require('../log');

function arraysIdentical(a: any[] | Buffer, b: any[] | Buffer) {
    let i = a.length;
    if (i !== b.length) return false;
    while (i--) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function shaArray(content: crypto.BinaryLike) {
    // we use this as a simple checksum and don't rely on its security, so SHA-1 is good enough
    return crypto.createHash('sha1').update(content).digest();
}

function pad(data: Buffer): Buffer {
    if (data.length > 16) {
        data = data.slice(0, 16);
    }
    else if (data.length < 16) {
        const zeros = Array(16 - data.length).fill(0);

        data = Buffer.concat([data, Buffer.from(zeros)]);
    }

    return Buffer.from(data);
}

function encrypt(key: Buffer, plainText: Buffer | string) {
    if (!key) {
        throw new Error("No data key!");
    }

    const plainTextBuffer = Buffer.from(plainText);

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-128-cbc', pad(key), pad(iv));

    const digest = shaArray(plainTextBuffer).slice(0, 4);

    const digestWithPayload = Buffer.concat([digest, plainTextBuffer]);

    const encryptedData = Buffer.concat([cipher.update(digestWithPayload), cipher.final()]);

    const encryptedDataWithIv = Buffer.concat([iv, encryptedData]);

    return encryptedDataWithIv.toString('base64');
}

function decrypt(key: Buffer, cipherText: string | Buffer): Buffer | false | null {
    if (cipherText === null) {
        return null;
    }

    if (!key) {
        return Buffer.from("[protected]");
    }

    try {
        const cipherTextBufferWithIv = Buffer.from(cipherText.toString(), 'base64');

        // old encrypted data can have IV of length 13, see some details here: https://github.com/zadam/trilium/issues/3017
        const ivLength = cipherTextBufferWithIv.length % 16 === 0 ? 16 : 13;

        const iv = cipherTextBufferWithIv.slice(0, ivLength);

        const cipherTextBuffer = cipherTextBufferWithIv.slice(ivLength);

        const decipher = crypto.createDecipheriv('aes-128-cbc', pad(key), pad(iv));

        const decryptedBytes = Buffer.concat([decipher.update(cipherTextBuffer), decipher.final()]);

        const digest = decryptedBytes.slice(0, 4);
        const payload = decryptedBytes.slice(4);

        const computedDigest = shaArray(payload).slice(0, 4);

        if (!arraysIdentical(digest, computedDigest)) {
            return false;
        }

        return payload;
    }
    catch (e: any) {
        // recovery from https://github.com/zadam/trilium/issues/510
        if (e.message?.includes("WRONG_FINAL_BLOCK_LENGTH") || e.message?.includes("wrong final block length")) {
            log.info("Caught WRONG_FINAL_BLOCK_LENGTH, returning cipherText instead");

            return Buffer.from(cipherText);
        }
        else {
            throw e;
        }
    }
}

function decryptString(dataKey: Buffer, cipherText: string) {
    const buffer = decrypt(dataKey, cipherText);

    if (buffer === null) {
        return null;
    } else if (buffer === false) {
        log.error(`Could not decrypt string. Buffer: ${buffer}`);

        throw new Error("Could not decrypt string.");
    }

    return buffer.toString('utf-8');
}

export = {
    encrypt,
    decrypt,
    decryptString
};
