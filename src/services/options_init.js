const optionService = require('./options');
const passwordEncryptionService = require('./password_encryption');
const myScryptService = require('./my_scrypt');
const appInfo = require('./app_info');
const utils = require('./utils');
const log = require('./log');
const dateUtils = require('./date_utils');
const keyboardActions = require('./keyboard_actions');

async function initDocumentOptions() {
    await optionService.createOption('documentId', utils.randomSecureToken(16), false);
    await optionService.createOption('documentSecret', utils.randomSecureToken(16), false);
}

async function initSyncedOptions(username, password) {
    await optionService.createOption('username', username, true);

    await optionService.createOption('passwordVerificationSalt', utils.randomSecureToken(32), true);
    await optionService.createOption('passwordDerivedKeySalt', utils.randomSecureToken(32), true);

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password), true);
    await optionService.createOption('passwordVerificationHash', passwordVerificationKey, true);

    // passwordEncryptionService expects these options to already exist
    await optionService.createOption('encryptedDataKey', '', true);

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

    await optionService.createOption('lastDailyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('lastWeeklyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('lastMonthlyBackupDate', dateUtils.utcNowDateTime(), false);
    await optionService.createOption('dbVersion', appInfo.dbVersion, false);

    await optionService.createOption('initialized', initialized ? 'true' : 'false', false);

    await optionService.createOption('lastSyncedPull', '0', false);
    await optionService.createOption('lastSyncedPush', '0', false);

    await optionService.createOption('theme', opts.theme || 'white', false);

    await optionService.createOption('syncServerHost', opts.syncServerHost || '', false);
    await optionService.createOption('syncServerTimeout', '5000', false);
    await optionService.createOption('syncProxy', opts.syncProxy || '', false);
}

const defaultOptions = [
    { name: 'noteRevisionSnapshotTimeInterval', value: '600', isSynced: true },
    { name: 'protectedSessionTimeout', value: '600', isSynced: true },
    { name: 'hoistedNoteId', value: 'root', isSynced: false },
    { name: 'zoomFactor', value: '1.0', isSynced: false },
    { name: 'leftPaneMinWidth', value: '350', isSynced: false },
    { name: 'leftPaneWidthPercent', value: '20', isSynced: false },
    { name: 'mainFontSize', value: '100', isSynced: false },
    { name: 'treeFontSize', value: '100', isSynced: false },
    { name: 'detailFontSize', value: '110', isSynced: false },
    { name: 'sidebarMinWidth', value: '350', isSynced: false },
    { name: 'sidebarWidthPercent', value: '25', isSynced: false },
    { name: 'showSidebarInNewTab', value: 'true', isSynced: false },
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
    { name: 'hideTabRowForOneTab', value: 'false', isSynced: false },
    { name: 'imageMaxWidthHeight', value: '1200', isSynced: true },
    { name: 'imageJpegQuality', value: '75', isSynced: true },
    { name: 'autoFixConsistencyIssues', value: 'true', isSynced: false }
];

async function initStartupOptions() {
    const optionsMap = await optionService.getOptionsMap();

    const allDefaultOptions = defaultOptions.concat(getKeyboardDefaultOptions());

    for (const {name, value, isSynced} of allDefaultOptions) {
        if (!(name in optionsMap)) {
            await optionService.createOption(name, value, isSynced);

            log.info(`Created missing option "${name}" with default value "${value}"`);
        }
    }
}

function getKeyboardDefaultOptions() {
    return keyboardActions.DEFAULT_KEYBOARD_ACTIONS.map(ka => {
        return {
            name: "keyboardShortcuts" + ka.optionName,
            value: JSON.stringify(ka.defaultShortcuts),
            isSynced: false
        };
    });
}

module.exports = {
    initDocumentOptions,
    initSyncedOptions,
    initNotSyncedOptions,
    initStartupOptions
};