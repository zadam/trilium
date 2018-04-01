"use strict";

const sql = require('../../services/sql');
const options = require('../../services/options');

// options allowed to be updated directly in options dialog
const ALLOWED_OPTIONS = ['protected_session_timeout', 'note_revision_snapshot_time_interval'];

async function getAllOptions() {
    return await sql.getMap("SELECT name, value FROM options");
}

async function getAllowedOptions() {
    const options = await sql.getMap("SELECT name, value FROM options WHERE name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    return options;
}

async function updateOption(req) {
    const body = req.body;

    if (!ALLOWED_OPTIONS.includes(body['name'])) {
        return [400, "not allowed option to set"];
    }

    await options.setOption(body['name'], body['value']);
}

module.exports = {
    getAllowedOptions,
    getAllOptions,
    updateOption
};