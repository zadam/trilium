const optionService = require('./options');
const myScryptService = require('./my_scrypt');
const utils = require('./utils');
const dataEncryptionService = require('./data_encryption');

function verifyPassword(password) {
    const givenPasswordHash = utils.toBase64(myScryptService.getVerificationHash(password));

    const dbPasswordHash = optionService.getOptionOrNull('passwordVerificationHash');

    if (!dbPasswordHash) {
        return false;
    }

    return givenPasswordHash === dbPasswordHash;
}

function setDataKey(password, plainTextDataKey) {
    const passwordDerivedKey = myScryptService.getPasswordDerivedKey(password);

    const newEncryptedDataKey = dataEncryptionService.encrypt(passwordDerivedKey, plainTextDataKey);

    optionService.setOption('encryptedDataKey', newEncryptedDataKey);
}

function getDataKey(password) {
    const passwordDerivedKey = myScryptService.getPasswordDerivedKey(password);

    const encryptedDataKey = optionService.getOption('encryptedDataKey');

    const decryptedDataKey = dataEncryptionService.decrypt(passwordDerivedKey, encryptedDataKey);

    return decryptedDataKey;
}

module.exports = {
    verifyPassword,
    getDataKey,
    setDataKey
};
