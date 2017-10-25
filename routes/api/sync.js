"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const audit_category = require('../../services/audit_category');
const auth = require('../../services/auth');

router.get('/', auth.checkApiAuth, async (req, res, next) => {
    const dict = {};

    const settings = await sql.getResults("SELECT opt_name, opt_value FROM options WHERE opt_name IN ("
        + ALLOWED_OPTIONS.map(x => '?').join(",") + ")", ALLOWED_OPTIONS);

    for (const set of settings) {
        dict[set['opt_name']] = set['opt_value'];
    }

    res.send(dict);
});

module.exports = router;