"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const audit_category = require('../../services/audit_category');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const build = require('../../services/build');
const packageJson = require('../../package');
const migration = require('../../services/migration');

// options allowed to be updated directly in settings dialog
const ALLOWED_OPTIONS = ['protected_session_timeout', 'history_snapshot_time_interval'];

function addExtraSettings(settings) {
    Object.assign(settings, build);

    settings['app_version'] = packageJson.version;
    settings['db_version'] = migration.APP_DB_VERSION;
}

router.get('/all', auth.checkApiAuth, async (req, res, next) => {
    const settings = await sql.getMap("SELECT opt_name, opt_value FROM options");

    addExtraSettings(settings);

    res.send(settings);
});

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const settings = await sql.getMap("SELECT opt_name, opt_value FROM options WHERE opt_name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    addExtraSettings(settings);

    res.send(settings);
});

router.post('/', async (req, res, next) => {
    const body = req.body;

    if (ALLOWED_OPTIONS.includes(body['name'])) {
        const optionName = await options.getOption(body['name']);

        await sql.doInTransaction(async () => {
            await sql.addAudit(audit_category.SETTINGS, utils.browserId(req), null, optionName, body['value'], body['name']);

            await options.setOption(body['name'], body['value']);
        });

        res.send({});
    }
    else {
        res.send("not allowed option to set");
    }
});

module.exports = router;