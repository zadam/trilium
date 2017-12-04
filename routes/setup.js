"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.get('', auth.checkAppNotInitialized, (req, res, next) => {
    res.render('setup', {});
});

module.exports = router;
