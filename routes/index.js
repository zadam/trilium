"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const migration = require('../services/migration');
const sql = require('../services/sql');

router.get('', auth.checkAuth, async (req, res, next) => {
    res.render('index', {});
});

module.exports = router;
