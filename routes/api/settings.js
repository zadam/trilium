"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const auth = require('../../services/auth');
const utils = require('../../services/utils');

// options allowed to be updated directly in settings dialog
const ALLOWED_OPTIONS = ['protected_session_timeout', 'history_snapshot_time_interval'];

router.get('/all', auth.checkApiAuth, async (req, res, next) => {
    const settings = await sql.getMap("SELECT opt_name, opt_value FROM options");

    res.send(settings);
});

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const settings = await sql.getMap("SELECT opt_name, opt_value FROM options WHERE opt_name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    res.send(settings);
});

router.post('/', async (req, res, next) => {
    const body = req.body;
    const sourceId = req.headers.source_id;

    if (ALLOWED_OPTIONS.includes(body['name'])) {
        const optionName = await options.getOption(body['name']);

        await sql.doInTransaction(async () => {
            await options.setOption(body['name'], body['value'], sourceId);
        });

        res.send({});
    }
    else {
        res.send("not allowed option to set");
    }
});

module.exports = router;