const optionService = require('../options.js');
const myScryptService = require('./my_scrypt.js');
const utils = require('../utils.js');
const dataEncryptionService = require('./data_encryption.js');

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

/** @return {Buffer} */
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
