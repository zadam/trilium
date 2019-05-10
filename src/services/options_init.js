const optionService = require('./options');
const passwordEncryptionService = require('./password_encryption');
const myScryptService = require('./my_scrypt');
const appInfo = require('./app_info');
const utils = require('./utils');
const dateUtils = require('./date_utils');

async function initDocumentOptions() {
    await optionService.createOption('documentId', utils.randomSecureToken(16), false);
    await optionService.createOption('documentSecret', utils.randomSecureToken(16), false);
}

async function initSyncedOptions(username, password) {
    await optionService.createOption('protectedSessionTimeout', 600, true);
    await optionService.createOption('noteRevisionSnapshotTimeInterval', 600, true);

    await optionService.createOption('username', username, true);

    await optionService.createOption('passwordVerificationSalt', utils.randomSecureToken(32), true);
    await optionService.createOption('passwordDerivedKeySalt', utils.randomSecureToken(32), true);

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password), true);
    await optionService.createOption('passwordVerificationHash', passwordVerificationKey, true);

    // passwordEncryptionService expects these options to already exist
    await optionService.createOption('encryptedDataKey', '', true);

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16), true);
}

async function initNotSyncedOptions(initialized, startNotePath = 'root', syncServerHost = '', syncProxy = '') {
    await optionService.createOption('openTabs', JSON.stringify([
        {
            notePath: startNotePath,
            active: 1
        }
    ]), false);
    await optionService.createOption('hoistedNoteId', 'root', false);
    await optionService.createOption('lastDailyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('lastWeeklyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('lastMonthlyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('dbVersion', appInfo.dbVersion, false);

    await optionService.createOption('lastSyncedPull', 0, false);
    await optionService.createOption('lastSyncedPush', 0, false);

    await optionService.createOption('zoomFactor', 1.0, false);
    await optionService.createOption('theme', 'white', false);

    await optionService.createOption('leftPaneMinWidth', '350', false);
    await optionService.createOption('leftPaneWidthPercent', '20', false);

    await optionService.createOption('syncServerHost', syncServerHost, false);
    await optionService.createOption('syncServerTimeout', 5000, false);
    await optionService.createOption('syncProxy', syncProxy, false);

    await optionService.createOption('mainFontSize', '100', false);
    await optionService.createOption('treeFontSize', '100', false);
    await optionService.createOption('detailFontSize', '110', false);

    await optionService.createOption('initialized', initialized ? 'true' : 'false', false);
}

module.exports = {
    initDocumentOptions,
    initSyncedOptions,
    initNotSyncedOptions
};