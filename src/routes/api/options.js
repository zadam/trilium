"use strict";

const optionService = require('../../services/options');
const log = require('../../services/log');
const attributes = require('../../services/attributes');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = [
    'protectedSessionTimeout',
    'noteRevisionSnapshotTimeInterval',
    'zoomFactor',
    'theme',
    'syncServerHost',
    'syncServerTimeout',
    'syncProxy',
    'leftPaneMinWidth',
    'leftPaneWidthPercent',
    'hoistedNoteId',
    'mainFontSize',
    'treeFontSize',
    'detailFontSize',
    'openTabs',
    'hideTabRowForOneTab'
];

async function getOptions() {
    return await optionService.getOptionsMap(ALLOWED_OPTIONS);
}

async function updateOption(req) {
    const {name, value} = req.params;

    if (!update(name, value)) {
        return [400, "not allowed option to change"];
    }
}

async function updateOptions(req) {
    for (const optionName in req.body) {
        if (!update(optionName, req.body[optionName])) {
            // this should be improved
            // it should return 400 instead of current 500, but at least it now rollbacks transaction
            throw new Error(`${optionName} is not allowed to change`);
        }
    }
}

async function update(name, value) {
    if (!ALLOWED_OPTIONS.includes(name)) {
        return false;
    }

    log.info(`Updating option ${name} to ${value}`);

    await optionService.setOption(name, value);

    return true;
}

async function getUserThemes() {
    const notes = await attributes.getNotesWithLabel('appTheme');

    const ret = [];

    for (const note of notes) {
        let value = await note.getLabelValue('appTheme');

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

module.exports = {
    getOptions,
    updateOption,
    updateOptions,
    getUserThemes
};