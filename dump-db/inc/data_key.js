const crypto = require("crypto");
const sql = require("./sql.js");
const decryptService = require("./decrypt.js");

function getDataKey(password) {
    if (!password) {
        return null;
    }

    try {
        const passwordDerivedKey = getPasswordDerivedKey(password);

        const encryptedDataKey = getOption('encryptedDataKey');

        const decryptedDataKey = decryptService.decrypt(passwordDerivedKey, encryptedDataKey, 16);

        return decryptedDataKey;
    }
    catch (e) {
        throw new Error(`Cannot read data key, the entered password might be wrong. The underlying error: '${e.message}', stack:\n${e.stack}`);
    }
}

function getPasswordDerivedKey(password) {
    const salt = getOption('passwordDerivedKeySalt');

    return getScryptHash(password, salt);
}

function getScryptHash(password, salt) {
    const hashed = crypto.scryptSync(password, salt, 32,
        {N: 16384, r:8, p:1});

    return hashed;
}

function getOption(name) {
    return sql.getValue("SELECT value FROM options WHERE name = ?", [name]);
}

module.exports = {
    getDataKey
};
