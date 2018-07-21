const optionService = require('./options');
const passwordEncryptionService = require('./password_encryption');
const myScryptService = require('./my_scrypt');
const appInfo = require('./app_info');
const utils = require('./utils');
const dateUtils = require('./date_utils');

async function initOptions(startNotePath, username, password) {
    await optionService.createOption('documentId', utils.randomSecureToken(16), false);
    await optionService.createOption('documentSecret', utils.randomSecureToken(16), false);

    await optionService.createOption('startNotePath', startNotePath, false);
    await optionService.createOption('protectedSessionTimeout', 600, true);
    await optionService.createOption('noteRevisionSnapshotTimeInterval', 600, true);
    await optionService.createOption('lastBackupDate', dateUtils.nowDate(), false);
    await optionService.createOption('dbVersion', appInfo.dbVersion, false);

    await optionService.createOption('lastSyncedPull', appInfo.dbVersion, false);
    await optionService.createOption('lastSyncedPush', 0, false);

    await optionService.createOption('zoomFactor', 1.0, false);
    await optionService.createOption('theme', 'white', false);

    await optionService.createOption('username', username);

    await optionService.createOption('passwordVerificationSalt', utils.randomSecureToken(32));
    await optionService.createOption('passwordDerivedKeySalt', utils.randomSecureToken(32));

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password));
    await optionService.createOption('passwordVerificationHash', passwordVerificationKey);

    // passwordEncryptionService expects these options to already exist
    await optionService.createOption('encryptedDataKey', '');
    await optionService.createOption('encryptedDataKeyIv', '');

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16));
}

module.exports = {
    initOptions
};