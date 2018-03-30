"use strict";

const sql = require('../../services/sql');
const options = require('../../services/options');

// options allowed to be updated directly in settings dialog
const ALLOWED_OPTIONS = ['protected_session_timeout', 'note_revision_snapshot_time_interval'];

async function getAllSettings() {
    return await sql.getMap("SELECT name, value FROM options");
}

async function getAllowedSettings() {
    const settings = await sql.getMap("SELECT name, value FROM options WHERE name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    return settings;
}

async function updateSetting(req) {
    const body = req.body;

    if (!ALLOWED_OPTIONS.includes(body['name'])) {
        return [400, "not allowed option to set"];
    }

    await options.setOption(body['name'], body['value']);
}

module.exports = {
    getAllowedSettings,
    getAllSettings,
    updateSetting
};