const options = require('./options');
const my_scrypt = require('./my_scrypt');
const utils = require('./utils');
const data_encryption = require('./data_encryption');

async function verifyPassword(password) {
    const givenPasswordHash = utils.toBase64(await my_scrypt.getVerificationHash(password));

    const dbPasswordHash = await options.getOption('password_verification_hash');

    return givenPasswordHash === dbPasswordHash;
}

async function setDataKeyCbc(password, plainText) {
    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = utils.randomSecureToken(16).slice(0, 16);

    await options.setOption('encrypted_data_key_iv', encryptedDataKeyIv);

    const buffer = Buffer.from(plainText);

    const newEncryptedDataKey = data_encryption.encryptCbc(passwordDerivedKey, encryptedDataKeyIv, buffer);

    await options.setOption('encrypted_data_key', newEncryptedDataKey);
}

async function getDecryptedDataKeyCbc(password) {
    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = await options.getOption('encrypted_data_key_iv');
    const encryptedDataKey = await options.getOption('encrypted_data_key');

    const decryptedDataKey = data_encryption.decryptCbc(passwordDerivedKey, encryptedDataKeyIv, encryptedDataKey);

    return decryptedDataKey;
}

module.exports = {
    verifyPassword,
    getDecryptedDataKeyCbc,
    setDataKeyCbc
};