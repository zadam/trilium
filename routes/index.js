"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const migration = require('../services/migration');
const sql = require('../services/sql');

router.get('', auth.checkAuth, async (req, res, next) => {
    const dbVersion = parseInt(await sql.getOption('db_version'))

    if (dbVersion < migration.APP_DB_VERSION) {
        res.redirect("migration");
    }
    else {
        res.render('index', {});
    }
});

module.exports = router;
