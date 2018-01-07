"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkAuthForMigrationPage, wrap(async (req, res, next) => {
    res.render('migration', {});
}));

module.exports = router;
