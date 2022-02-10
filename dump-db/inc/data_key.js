import crypto from "crypto";
import sql from "./sql.js";

function getDataKey(password) {
    const passwordDerivedKey = getPasswordDerivedKey(password);

    const encryptedDataKey = getOption('encryptedDataKey');

    const decryptedDataKey = decrypt(passwordDerivedKey, encryptedDataKey, 16);

    return decryptedDataKey;
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
    return sql.getValue("SELECT value FROM options WHERE name = ?", name);
}

module.exports = {
    getDataKey
};
