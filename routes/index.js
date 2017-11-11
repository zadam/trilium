"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const utils = require('../services/utils');

router.get('', auth.checkAuth, async (req, res, next) => {
    res.render('index', {
        browserId: utils.randomString(12)
    });
});

module.exports = router;
