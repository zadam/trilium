"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const migration = require('../../services/migration');

router.get('', auth.checkApiAuth, async (req, res, next) => {
    res.send({
        'db_version': parseInt(await sql.getOption('db_version')),
        'app_db_version': migration.APP_DB_VERSION
    });
});

router.post('', auth.checkApiAuth, async (req, res, next) => {
    const migrations = await migration.migrate();

    res.send({
        'migrations': migrations
    });
});

module.exports = router;