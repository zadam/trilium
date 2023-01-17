"use strict";

const optionService = require('../../services/options');
const log = require('../../services/log');
const searchService = require('../../services/search/services/search');
const ValidationError = require("../../errors/validation_error");

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = new Set([
    'eraseEntitiesAfterTimeInSeconds',
    'protectedSessionTimeout',
    'noteRevisionSnapshotTimeInterval',
    'zoomFactor',
    'theme',
    'syncServerHost',
    'syncServerTimeout',
    'syncProxy',
    'hoistedNoteId',
    'mainFontSize',
    'mainFontFamily',
    'treeFontSize',
    'treeFontFamily',
    'detailFontSize',
    'detailFontFamily',
    'monospaceFontSize',
    'monospaceFontFamily',
    'openTabs',
    'noteInfoWidget',
    'attributesWidget',
    'linkMapWidget',
    'noteRevisionsWidget',
    'whatLinksHereWidget',
    'similarNotesWidget',
    'editedNotesWidget',
    'calendarWidget',
    'vimKeymapEnabled',
    'codeLineWrapEnabled',
    'codeNotesMimeTypes',
    'spellCheckEnabled',
    'spellCheckLanguageCode',
    'imageMaxWidthHeight',
    'imageJpegQuality',
    'leftPaneWidth',
    'rightPaneWidth',
    'leftPaneVisible',
    'rightPaneVisible',
    'nativeTitleBarVisible',
    'attributeListExpanded',
    'promotedAttributesExpanded',
    'similarNotesExpanded',
    'headingStyle',
    'autoCollapseNoteTree',
    'autoReadonlySizeText',
    'autoReadonlySizeCode',
    'overrideThemeFonts',
    'dailyBackupEnabled',
    'weeklyBackupEnabled',
    'monthlyBackupEnabled',
    'maxContentWidth',
    'compressImages',
    'downloadImagesAutomatically',
    'minTocHeadings',
    'checkForUpdates',
    'disableTray'
]);

function getOptions() {
    const optionMap = optionService.getOptionsMap();
    const resultMap = {};

    for (const optionName in optionMap) {
        if (isAllowed(optionName)) {
            resultMap[optionName] = optionMap[optionName];
        }
    }

    resultMap['isPasswordSet'] = !!optionMap['passwordVerificationHash'] ? 'true' : 'false';

    return resultMap;
}

function updateOption(req) {
    const {name, value} = req.params;

    if (!update(name, value)) {
        throw new ValidationError("not allowed option to change");
    }
}

function updateOptions(req) {
    for (const optionName in req.body) {
        if (!update(optionName, req.body[optionName])) {
            // this should be improved
            // it should return 400 instead of current 500, but at least it now rollbacks transaction
            throw new Error(`${optionName} is not allowed to change`);
        }
    }
}

function update(name, value) {
    if (!isAllowed(name)) {
        return false;
    }

    if (name !== 'openTabs') {
        log.info(`Updating option ${name} to ${value}`);
    }

    optionService.setOption(name, value);

    return true;
}

function getUserThemes() {
    const notes = searchService.searchNotes("#appTheme", {ignoreHoistedNote: true});
    const ret = [];

    for (const note of notes) {
        let value = note.getOwnedLabelValue('appTheme');

        if (!value) {
            value = note.title.toLowerCase().replace(/[^a-z0-9]/gi, '-');
        }

        ret.push({
            val: value,
            title: note.title,
            noteId: note.noteId
        });
    }

    return ret;
}

function isAllowed(name) {
    return ALLOWED_OPTIONS.has(name)
        || name.startsWith("keyboardShortcuts")
        || name.endsWith("Collapsed")
        || name.startsWith("hideArchivedNotes")
        || name.startsWith("hideIncludedImages");
}

module.exports = {
    getOptions,
    updateOption,
    updateOptions,
    getUserThemes
};
