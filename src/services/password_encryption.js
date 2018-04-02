const optionService = require('./options');
const myScryptService = require('./my_scrypt');
const utils = require('./utils');
const dataEncryptionService = require('./data_encryption');

async function verifyPassword(password) {
    const givenPasswordHash = utils.toBase64(await myScryptService.getVerificationHash(password));

    const dbPasswordHash = await optionService.getOption('password_verification_hash');

    return givenPasswordHash === dbPasswordHash;
}

async function setDataKey(password, plainTextDataKey) {
    const passwordDerivedKey = await myScryptService.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = utils.randomString(16);

    await optionService.setOption('encrypted_data_key_iv', encryptedDataKeyIv);

    const buffer = Buffer.from(plainTextDataKey);

    const newEncryptedDataKey = dataEncryptionService.encrypt(passwordDerivedKey, encryptedDataKeyIv, buffer);

    await optionService.setOption('encrypted_data_key', newEncryptedDataKey);
}

async function getDataKey(password) {
    const passwordDerivedKey = await myScryptService.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = await optionService.getOption('encrypted_data_key_iv');
    const encryptedDataKey = await optionService.getOption('encrypted_data_key');

    const decryptedDataKey = dataEncryptionService.decrypt(passwordDerivedKey, encryptedDataKeyIv, encryptedDataKey);

    return decryptedDataKey;
}

module.exports = {
    verifyPassword,
    getDataKey,
    setDataKey
};