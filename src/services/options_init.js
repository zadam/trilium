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

    await optionService.createOption('codeNotesMimeTypes', '["text/x-csrc","text/x-c++src","text/x-csharp","text/css","text/x-go","text/x-groovy","text/x-haskell","text/html","message/http","text/x-java","application/javascript;env=frontend","application/javascript;env=backend","application/json","text/x-kotlin","text/x-markdown","text/x-perl","text/x-php","text/x-python","text/x-ruby",null,"text/x-sql","text/x-swift","text/xml","text/x-yaml"]', true);

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16), true);
}

async function initNotSyncedOptions(initialized, startNotePath = 'root', opts = {}) {
    await optionService.createOption('openTabs', JSON.stringify([
        {
            notePath: startNotePath,
            active: true,
            sidebar: {
                visible: true,
                widgets: []
            }
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
    await optionService.createOption('theme', opts.theme || 'white', false);

    await optionService.createOption('leftPaneMinWidth', '350', false);
    await optionService.createOption('leftPaneWidthPercent', '20', false);

    await optionService.createOption('syncServerHost', opts.syncServerHost || '', false);
    await optionService.createOption('syncServerTimeout', 5000, false);
    await optionService.createOption('syncProxy', opts.syncProxy || '', false);

    await optionService.createOption('mainFontSize', '100', false);
    await optionService.createOption('treeFontSize', '100', false);
    await optionService.createOption('detailFontSize', '110', false);

    await optionService.createOption('sidebarMinWidth', '350', false);
    await optionService.createOption('sidebarWidthPercent', '25', false);

    await optionService.createOption('showSidebarInNewTab', 'true', false);

    await optionService.createOption('noteInfoWidget', '{"enabled":true,"expanded":true,"position":10}', false);
    await optionService.createOption('attributesWidget', '{"enabled":true,"expanded":true,"position":20}', false);
    await optionService.createOption('linkMapWidget', '{"enabled":true,"expanded":true,"position":30}', false);
    await optionService.createOption('noteRevisionsWidget', '{"enabled":true,"expanded":true,"position":40}', false);
    await optionService.createOption('whatLinksHereWidget', '{"enabled":false,"expanded":true,"position":50}', false);

    await optionService.createOption('initialized', initialized ? 'true' : 'false', false);
}

module.exports = {
    initDocumentOptions,
    initSyncedOptions,
    initNotSyncedOptions
};