"use strict";

const express = require('express');
const router = express.Router();
const anonymization = require('../../services/anonymization');

router.post('/anonymize', async (req, res, next) => {
    await anonymization.anonymize();

    res.send({});
});

module.exports = router;