const optionService = require('./options');
const passwordEncryptionService = require('./password_encryption');
const myScryptService = require('./my_scrypt');
const appInfo = require('./app_info');
const utils = require('./utils');
const log = require('./log');
const dateUtils = require('./date_utils');
const keyboardActions = require('./keyboard_actions');

function initDocumentOptions() {
    optionService.createOption('documentId', utils.randomSecureToken(16), false);
    optionService.createOption('documentSecret', utils.randomSecureToken(16), false);
}

function initSyncedOptions(username, password) {
    optionService.createOption('username', username, true);

    optionService.createOption('passwordVerificationSalt', utils.randomSecureToken(32), true);
    optionService.createOption('passwordDerivedKeySalt', utils.randomSecureToken(32), true);

    const passwordVerificationKey = utils.toBase64(myScryptService.getVerificationHash(password), true);
    optionService.createOption('passwordVerificationHash', passwordVerificationKey, true);

    // passwordEncryptionService expects these options to already exist
    optionService.createOption('encryptedDataKey', '', true);

    passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16), true);
}

function initNotSyncedOptions(initialized, startNotePath = 'root', opts = {}) {
    optionService.createOption('openTabs', JSON.stringify([
        {
            notePath: startNotePath,
            active: true,
            sidebar: {
                widgets: []
            }
        }
    ]), false);

    optionService.createOption('lastDailyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('lastWeeklyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('lastMonthlyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('dbVersion', appInfo.dbVersion, false);

    optionService.createOption('initialized', initialized ? 'true' : 'false', false);

    optionService.createOption('lastSyncedPull', '0', false);
    optionService.createOption('lastSyncedPush', '0', false);

    optionService.createOption('theme', opts.theme || 'white', false);

    optionService.createOption('syncServerHost', opts.syncServerHost || '', false);
    optionService.createOption('syncServerTimeout', '60000', false);
    optionService.createOption('syncProxy', opts.syncProxy || '', false);
}

const defaultOptions = [
    { name: 'noteRevisionSnapshotTimeInterval', value: '600', isSynced: true },
    { name: 'protectedSessionTimeout', value: '600', isSynced: true },
    { name: 'hoistedNoteId', value: 'root', isSynced: false },
    { name: 'zoomFactor', value: '1.0', isSynced: false },
    { name: 'mainFontSize', value: '100', isSynced: false },
    { name: 'treeFontSize', value: '100', isSynced: false },
    { name: 'detailFontSize', value: '110', isSynced: false },
    { name: 'calendarWidget', value: '{"enabled":true,"expanded":true,"position":20}', isSynced: false },
    { name: 'editedNotesWidget', value: '{"enabled":true,"expanded":true,"position":50}', isSynced: false },
    { name: 'noteInfoWidget', value: '{"enabled":true,"expanded":true,"position":100}', isSynced: false },
    { name: 'attributesWidget', value: '{"enabled":true,"expanded":true,"position":200}', isSynced: false },
    { name: 'linkMapWidget', value: '{"enabled":true,"expanded":true,"position":300}', isSynced: false },
    { name: 'noteRevisionsWidget', value: '{"enabled":true,"expanded":true,"position":400}', isSynced: false },
    { name: 'whatLinksHereWidget', value: '{"enabled":false,"expanded":true,"position":500}', isSynced: false },
    { name: 'similarNotesWidget', value: '{"enabled":true,"expanded":true,"position":600}', isSynced: false },
    { name: 'spellCheckEnabled', value: 'true', isSynced: false },
    { name: 'spellCheckLanguageCode', value: 'en-US', isSynced: false },
    { name: 'imageMaxWidthHeight', value: '1200', isSynced: true },
    { name: 'imageJpegQuality', value: '75', isSynced: true },
    { name: 'autoFixConsistencyIssues', value: 'true', isSynced: false },
    { name: 'codeNotesMimeTypes', value: '["text/x-csrc","text/x-c++src","text/x-csharp","text/css","text/x-go","text/x-groovy","text/x-haskell","text/html","message/http","text/x-java","application/javascript;env=frontend","application/javascript;env=backend","application/json","text/x-kotlin","text/x-markdown","text/x-perl","text/x-php","text/x-python","text/x-ruby",null,"text/x-sql","text/x-sqlite;schema=trilium","text/x-swift","text/xml","text/x-yaml"]', isSynced: true },
    { name: 'leftPaneWidth', value: '25', isSynced: false },
    { name: 'leftPaneVisible', value: 'true', isSynced: false },
    { name: 'rightPaneWidth', value: '25', isSynced: false },
    { name: 'rightPaneVisible', value: 'true', isSynced: false },
    { name: 'nativeTitleBarVisible', value: 'false', isSynced: false },
    { name: 'eraseNotesAfterTimeInSeconds', value: '604800', isSynced: true }, // default is 7 days
    { name: 'hideArchivedNotes_main', value: 'false', isSynced: false },
    { name: 'hideIncludedImages_main', value: 'true', isSynced: false },
    { name: 'attributeListExpanded', value: 'false', isSynced: false },
    { name: 'promotedAttributesExpanded', value: 'true', isSynced: true },
    { name: 'similarNotesExpanded', value: 'true', isSynced: true }
];

function initStartupOptions() {
    const optionsMap = optionService.getOptionsMap();

    const allDefaultOptions = defaultOptions.concat(getKeyboardDefaultOptions());

    for (const {name, value, isSynced} of allDefaultOptions) {
        if (!(name in optionsMap)) {
            optionService.createOption(name, value, isSynced);

            log.info(`Created missing option "${name}" with default value "${value}"`);
        }
    }
}

function getKeyboardDefaultOptions() {
    return keyboardActions.DEFAULT_KEYBOARD_ACTIONS
        .filter(ka => !!ka.actionName)
        .map(ka => ({
            name: "keyboardShortcuts" + ka.actionName.charAt(0).toUpperCase() + ka.actionName.slice(1),
            value: JSON.stringify(ka.defaultShortcuts),
            isSynced: false
        }));
}

module.exports = {
    initDocumentOptions,
    initSyncedOptions,
    initNotSyncedOptions,
    initStartupOptions
};
