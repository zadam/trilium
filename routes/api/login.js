"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const crypto = require('crypto');

router.post('', async (req, res, next) => {
    const timestamp = req.body.timestamp;

    const now = utils.nowTimestamp();

    if (Math.abs(timestamp - now) > 5) {
        res.status(400);
        res.send({ message: 'Auth request time is out of sync' });
    }

    const dbVersion = res.body.dbVersion;

    if (dbVersion !== migration.APP_DB_VERSION) {
        res.status(400);
        res.send({ message: 'Non-matching db versions, local is version ' + migration.APP_DB_VERSION });
    }

    const documentSecret = await sql.getOption('document_secret');

    const hmac = crypto.createHmac('sha256', documentSecret);
    hmac.update(timestamp);
    const expectedHash = hmac.digest('base64');

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        res.status(400);
        res.send({ message: "Hash doesn't match" });
    }

    req.session.loggedIn = true;

    res.send({});
});

module.exports = router;