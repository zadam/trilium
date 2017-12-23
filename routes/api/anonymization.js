"use strict";

const express = require('express');
const router = express.Router();
const anonymization = require('../../services/anonymization');
const auth = require('../../services/auth');

router.post('/anonymize', auth.checkApiAuth, async (req, res, next) => {
    await anonymization.anonymize();

    res.send({});
});

module.exports = router;