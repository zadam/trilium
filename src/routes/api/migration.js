"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const options = require('../../services/options');
const migration = require('../../services/migration');
const app_info = require('../../services/app_info');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkApiAuthForMigrationPage, wrap(async (req, res, next) => {
    res.send({
        db_version: parseInt(await options.getOption('db_version')),
        app_db_version: app_info.db_version
    });
}));

router.post('', auth.checkApiAuthForMigrationPage, wrap(async (req, res, next) => {
    const migrations = await migration.migrate();

    res.send({
        migrations: migrations
    });
}));

module.exports = router;