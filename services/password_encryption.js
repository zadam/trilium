const options = require('./options');
const my_scrypt = require('./my_scrypt');
const utils = require('./utils');
const crypto = require('crypto');
const aesjs = require('./aes');
const data_encryption = require('./data_encryption');

async function verifyPassword(password) {
    const givenPasswordHash = utils.toBase64(await my_scrypt.getVerificationHash(password));

    const dbPasswordHash = await options.getOption('password_verification_hash');

    return givenPasswordHash === dbPasswordHash;
}

function decryptDataKey(passwordDerivedKey, encryptedBase64) {
    const encryptedBytes = utils.fromBase64(encryptedBase64);

    const aes = getAes(passwordDerivedKey);
    return Array.from(aes.decrypt(encryptedBytes).slice(4));
}

function encryptDataKey(passwordDerivedKey, plainText) {
    const aes = getAes(passwordDerivedKey);

    const plainTextBuffer = Buffer.from(plainText, 'latin1');

    const digest = crypto.createHash('sha256').update(plainTextBuffer).digest().slice(0, 4);

    const encryptedBytes = aes.encrypt(Buffer.concat([digest, plainTextBuffer]));

    return utils.toBase64(encryptedBytes);
}

async function setDataKey(passwordDerivedKey, plainText) {
    const newEncryptedDataKey = encryptDataKey(passwordDerivedKey, plainText);

    await options.setOption('encrypted_data_key', newEncryptedDataKey);
}

async function setDataKeyCbc(password, plainText) {
    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = utils.randomSecureToken(16).slice(0, 16);

    await options.setOption('encrypted_data_key_iv', encryptedDataKeyIv);

    const buffer = Buffer.from(plainText);

    const newEncryptedDataKey = data_encryption.encryptCbc(passwordDerivedKey, encryptedDataKeyIv, buffer);

    await options.setOption('encrypted_data_key', newEncryptedDataKey);
}

async function getDecryptedDataKey(password) {
    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    const encryptedDataKey = await options.getOption('encrypted_data_key');

    const decryptedDataKey = decryptDataKey(passwordDerivedKey, encryptedDataKey);

    return decryptedDataKey;
}

async function getDecryptedDataKeyCbc(password) {
    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = await options.getOption('encrypted_data_key_iv');
    const encryptedDataKey = await options.getOption('encrypted_data_key');

    const decryptedDataKey = data_encryption.decryptCbc(passwordDerivedKey, encryptedDataKeyIv, encryptedDataKey);

    return decryptedDataKey;
}

function getAes(key) {
    return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
}

module.exports = {
    verifyPassword,
    getDecryptedDataKey,
    getDecryptedDataKeyCbc,
    setDataKey,
    setDataKeyCbc
};