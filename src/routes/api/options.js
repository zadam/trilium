"use strict";

const optionService = require('../../services/options');
const log = require('../../services/log');
const attributes = require('../../services/attributes');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = new Set([
    'username', // not exposed for update (not harmful anyway), needed for reading
    'eraseNotesAfterTimeInSeconds',
    'protectedSessionTimeout',
    'noteRevisionSnapshotTimeInterval',
    'zoomFactor',
    'theme',
    'syncServerHost',
    'syncServerTimeout',
    'syncProxy',
    'hoistedNoteId',
    'mainFontSize',
    'treeFontSize',
    'detailFontSize',
    'openTabs',
    'noteInfoWidget',
    'attributesWidget',
    'linkMapWidget',
    'noteRevisionsWidget',
    'whatLinksHereWidget',
    'similarNotesWidget',
    'editedNotesWidget',
    'calendarWidget',
    'codeNotesMimeTypes',
    'spellCheckEnabled',
    'spellCheckLanguageCode',
    'imageMaxWidthHeight',
    'imageJpegQuality',
    'leftPaneWidth',
    'rightPaneWidth',
    'leftPaneVisible',
    'rightPaneVisible',
    'nativeTitleBarVisible'
]);

async function getOptions() {
    const optionMap = await optionService.getOptionsMap();
    const resultMap = {};

    for (const optionName in optionMap) {
        if (isAllowed(optionName)) {
            resultMap[optionName] = optionMap[optionName];
        }
    }

    return resultMap;
}

async function updateOption(req) {
    const {name, value} = req.params;

    if (!await update(name, value)) {
        return [400, "not allowed option to change"];
    }
}

async function updateOptions(req) {
    for (const optionName in req.body) {
        if (!await update(optionName, req.body[optionName])) {
            // this should be improved
            // it should return 400 instead of current 500, but at least it now rollbacks transaction
            throw new Error(`${optionName} is not allowed to change`);
        }
    }
}

async function update(name, value) {
    if (!isAllowed(name)) {
        return false;
    }

    if (name !== 'openTabs') {
        log.info(`Updating option ${name} to ${value}`);
    }

    await optionService.setOption(name, value);

    return true;
}

async function getUserThemes() {
    const notes = await attributes.getNotesWithLabel('appTheme');

    const ret = [];

    for (const note of notes) {
        let value = await note.getOwnedLabelValue('appTheme');

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