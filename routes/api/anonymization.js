"use strict";

const express = require('express');
const router = express.Router();
const anonymization = require('../../services/anonymization');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.post('/anonymize', auth.checkApiAuth, wrap(async (req, res, next) => {
    await anonymization.anonymize();

    res.send({});
}));

module.exports = router;