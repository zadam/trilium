"use strict";

const express = require('express');
const router = express.Router();
const options = require('../../services/options');
const utils = require('../../services/utils');
const migration = require('../../services/migration');
const SOURCE_ID = require('../../services/source_id');

router.post('', async (req, res, next) => {
    const timestamp = req.body.timestamp;

    const now = utils.nowTimestamp();

    if (Math.abs(timestamp - now) > 5) {
        res.status(400);
        res.send({ message: 'Auth request time is out of sync' });
    }

    const dbVersion = req.body.dbVersion;

    if (dbVersion !== migration.APP_DB_VERSION) {
        res.status(400);
        res.send({ message: 'Non-matching db versions, local is version ' + migration.APP_DB_VERSION });
    }

    const documentSecret = await options.getOption('document_secret');
    const expectedHash = utils.hmac(documentSecret, timestamp);

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        res.status(400);
        res.send({ message: "Hash doesn't match" });
    }

    req.session.loggedIn = true;

    res.send({
        sourceId: SOURCE_ID
    });
});

module.exports = router;