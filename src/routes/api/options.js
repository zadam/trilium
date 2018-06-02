"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const log = require('../../services/log');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = ['protectedSessionTimeout', 'noteRevisionSnapshotTimeInterval', 'zoomFactor'];

async function getOptions() {
    const options = await sql.getMap("SELECT name, value FROM options WHERE name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    return options;
}

async function updateOption(req) {
    const {name, value} = req.params;

    if (!ALLOWED_OPTIONS.includes(name)) {
        return [400, "not allowed option to set"];
    }

    log.info(`Updating option ${name} to ${value}`);

    await optionService.setOption(name, value);
}

module.exports = {
    getOptions,
    updateOption
};