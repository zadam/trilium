const optionService = require('./options');
const appInfo = require('./app_info');
const utils = require('./utils');
const log = require('./log');
const dateUtils = require('./date_utils');
const keyboardActions = require('./keyboard_actions');

function initDocumentOptions() {
    optionService.createOption('documentId', utils.randomSecureToken(16), false);
    optionService.createOption('documentSecret', utils.randomSecureToken(16), false);
}

function initNotSyncedOptions(initialized, opts = {}) {
    optionService.createOption('openTabs', JSON.stringify([
        {
            notePath: 'root',
            active: true
        }
    ]), false);

    optionService.createOption('lastDailyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('lastWeeklyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('lastMonthlyBackupDate', dateUtils.utcNowDateTime(), false);
    optionService.createOption('dbVersion', appInfo.dbVersion, false);

    optionService.createOption('initialized', initialized ? 'true' : 'false', false);

    optionService.createOption('lastSyncedPull', '0', false);
    optionService.createOption('lastSyncedPush', '0', false);

    let theme = 'dark'; // default based on the poll in https://github.com/zadam/trilium/issues/2516
    
    if (utils.isElectron()) {
        const {nativeTheme} = require('electron');
        
        theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    }
    
    optionService.createOption('theme', theme, false);

    optionService.createOption('syncServerHost', opts.syncServerHost || '', false);
    optionService.createOption('syncServerTimeout', '120000', false);
    optionService.createOption('syncProxy', opts.syncProxy || '', false);
}

const defaultOptions = [
    { name: 'noteRevisionSnapshotTimeInterval', value: '600', isSynced: true },
    { name: 'protectedSessionTimeout', value: '600', isSynced: true },
    { name: 'zoomFactor', value: process.platform === "win32" ? '0.9' : '1.0', isSynced: false },
    { name: 'overrideThemeFonts', value: 'false', isSynced: false },
    { name: 'mainFontFamily', value: 'theme', isSynced: false },
    { name: 'mainFontSize', value: '100', isSynced: false },
    { name: 'treeFontFamily', value: 'theme', isSynced: false },
    { name: 'treeFontSize', value: '100', isSynced: false },
    { name: 'detailFontFamily', value: 'theme', isSynced: false },
    { name: 'detailFontSize', value: '110', isSynced: false },
    { name: 'monospaceFontFamily', value: 'theme', isSynced: false },
    { name: 'monospaceFontSize', value: '110', isSynced: false },
    { name: 'spellCheckEnabled', value: 'true', isSynced: false },
    { name: 'spellCheckLanguageCode', value: 'en-US', isSynced: false },
    { name: 'imageMaxWidthHeight', value: '2000', isSynced: true },
    { name: 'imageJpegQuality', value: '75', isSynced: true },
    { name: 'autoFixConsistencyIssues', value: 'true', isSynced: false },
    { name: 'vimKeymapEnabled', value: 'false', isSynced: false },
    { name: 'codeNotesMimeTypes', value: '["text/x-csrc","text/x-c++src","text/x-csharp","text/css","text/x-go","text/x-groovy","text/x-haskell","text/html","message/http","text/x-java","application/javascript;env=frontend","application/javascript;env=backend","application/json","text/x-kotlin","text/x-markdown","text/x-perl","text/x-php","text/x-python","text/x-ruby",null,"text/x-sql","text/x-sqlite;schema=trilium","text/x-swift","text/xml","text/x-yaml"]', isSynced: true },
    { name: 'leftPaneWidth', value: '25', isSynced: false },
    { name: 'leftPaneVisible', value: 'true', isSynced: false },
    { name: 'rightPaneWidth', value: '25', isSynced: false },
    { name: 'rightPaneVisible', value: 'true', isSynced: false },
    { name: 'nativeTitleBarVisible', value: 'false', isSynced: false },
    { name: 'eraseEntitiesAfterTimeInSeconds', value: '604800', isSynced: true }, // default is 7 days
    { name: 'hideArchivedNotes_main', value: 'false', isSynced: false },
    { name: 'hideIncludedImages_main', value: 'true', isSynced: false },
    { name: 'attributeListExpanded', value: 'false', isSynced: false },
    { name: 'promotedAttributesExpanded', value: 'true', isSynced: true },
    { name: 'similarNotesExpanded', value: 'true', isSynced: true },
    { name: 'debugModeEnabled', value: 'false', isSynced: false },
    { name: 'headingStyle', value: 'underline', isSynced: true },
    { name: 'autoCollapseNoteTree', value: 'true', isSynced: true },
    { name: 'autoReadonlySizeText', value: '10000', isSynced: false },
    { name: 'autoReadonlySizeCode', value: '30000', isSynced: false },
    { name: 'dailyBackupEnabled', value: 'true', isSynced: false },
    { name: 'weeklyBackupEnabled', value: 'true', isSynced: false },
    { name: 'monthlyBackupEnabled', value: 'true', isSynced: false },
    { name: 'maxContentWidth', value: '1200', isSynced: false },
    { name: 'compressImages', value: 'true', isSynced: true }
];

function initStartupOptions() {
    const optionsMap = optionService.getOptionsMap();

    const allDefaultOptions = defaultOptions.concat(getKeyboardDefaultOptions());

    for (const {name, value, isSynced} of allDefaultOptions) {
        if (!(name in optionsMap)) {
            optionService.createOption(name, value, isSynced);

            log.info(`Created option "${name}" with default value "${value}"`);
        }
    }

    if (process.env.TRILIUM_START_NOTE_ID || process.env.TRILIUM_SAFE_MODE) {
        optionService.setOption('openTabs', JSON.stringify([
            {
                notePath: process.env.TRILIUM_START_NOTE_ID || 'root',
                active: true
            }
        ]));
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
    initNotSyncedOptions,
    initStartupOptions
};
