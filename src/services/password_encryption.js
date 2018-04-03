const optionService = require('./options');
const myScryptService = require('./my_scrypt');
const utils = require('./utils');
const dataEncryptionService = require('./data_encryption');

async function verifyPassword(password) {
    const givenPasswordHash = utils.toBase64(await myScryptService.getVerificationHash(password));

    const dbPasswordHash = await optionService.getOption('passwordVerificationHash');

    return givenPasswordHash === dbPasswordHash;
}

async function setDataKey(password, plainTextDataKey) {
    const passwordDerivedKey = await myScryptService.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = utils.randomString(16);

    await optionService.setOption('encryptedDataKeyIv', encryptedDataKeyIv);

    const buffer = Buffer.from(plainTextDataKey);

    const newEncryptedDataKey = dataEncryptionService.encrypt(passwordDerivedKey, encryptedDataKeyIv, buffer);

    await optionService.setOption('encryptedDataKey', newEncryptedDataKey);
}

async function getDataKey(password) {
    const passwordDerivedKey = await myScryptService.getPasswordDerivedKey(password);

    const encryptedDataKeyIv = await optionService.getOption('encryptedDataKeyIv');
    const encryptedDataKey = await optionService.getOption('encryptedDataKey');

    const decryptedDataKey = dataEncryptionService.decrypt(passwordDerivedKey, encryptedDataKeyIv, encryptedDataKey);

    return decryptedDataKey;
}

module.exports = {
    verifyPassword,
    getDataKey,
    setDataKey
};