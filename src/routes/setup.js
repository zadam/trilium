"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkAppNotInitialized, wrap(async (req, res, next) => {
    res.render('setup', {});
}));

module.exports = router;
