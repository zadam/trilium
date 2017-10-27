"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.get('', auth.checkAuthWithoutMigration, (req, res, next) => {
    res.render('migration', {});
});

module.exports = router;
