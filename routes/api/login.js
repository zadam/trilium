"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const migration = require('../../services/migration');

router.post('', async (req, res, next) => {


    res.send({
        'db_version': parseInt(await sql.getOption('db_version')),
        'app_db_version': migration.APP_DB_VERSION
    });
});

module.exports = router;