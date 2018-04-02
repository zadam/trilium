"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = ['protected_session_timeout', 'note_revision_snapshot_time_interval'];

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

    await optionService.setOption(name, value);
}

module.exports = {
    getOptions,
    updateOption
};