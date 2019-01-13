"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const log = require('../../services/log');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = ['protectedSessionTimeout', 'noteRevisionSnapshotTimeInterval',
    'zoomFactor', 'theme', 'syncServerHost', 'syncServerTimeout', 'syncProxy', 'leftPaneMinWidth', 'leftPaneWidthPercent', 'hoistedNoteId', 'mainFontSize', 'treeFontSize', 'detailFontSize'];

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

module.exports = {
    getOptions,
    updateOption,
    updateOptions
};