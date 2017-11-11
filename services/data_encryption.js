const protected_session = require('./protected_session');
const utils = require('./utils');
const aesjs = require('./aes');

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

    return aesjs.utils.utf8.fromBytes(payload);
}

module.exports = {
    getProtectedSessionId,
    decrypt
};