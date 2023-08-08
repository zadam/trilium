const crypto = require("crypto");

function decryptString(dataKey, cipherText) {
    const buffer = decrypt(dataKey, cipherText);

    if (buffer === null) {
        return null;
    }

    const str = buffer.toString('utf-8');

    if (str === 'false') {
        throw new Error("Could not decrypt string.");
    }

    return str;
}

function decrypt(key, cipherText, ivLength = 13) {
    if (cipherText === null) {
        return null;
    }

    if (!key) {
        return "[protected]";
    }

    try {
        const cipherTextBufferWithIv = Buffer.from(cipherText.toString(), 'base64');
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
    catch (e) {
        // recovery from https://github.com/zadam/trilium/issues/510
        if (e.message?.includes("WRONG_FINAL_BLOCK_LENGTH") || e.message?.includes("wrong final block length")) {
            log.info("Caught WRONG_FINAL_BLOCK_LENGTH, returning cipherText instead");

            return cipherText;
        }
        else {
            throw e;
        }
    }
}

function pad(data) {
    if (data.length > 16) {
        data = data.slice(0, 16);
    }
    else if (data.length < 16) {
        const zeros = Array(16 - data.length).fill(0);

        data = Buffer.concat([data, Buffer.from(zeros)]);
    }

    return Buffer.from(data);
}

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

module.exports = {
    decrypt,
    decryptString
};
