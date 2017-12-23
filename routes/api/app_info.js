"use strict";

const express = require('express');
const router = express.Router();
const app_info = require('../../services/app_info');
const auth = require('../../services/auth');

router.get('', auth.checkApiAuth, async (req, res, next) => {
    res.send(app_info);
});

module.exports = router;