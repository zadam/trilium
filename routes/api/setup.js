"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const options = require('../../services/options');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const my_scrypt = require('../../services/my_scrypt');
const password_encryption = require('../../services/password_encryption');

router.post('', auth.checkAppNotInitialized, async (req, res, next) => {
    const { username, password } = req.body;

    await sql.doInTransaction(async () => {
        await options.setOption('username', username);

        await options.setOption('password_verification_salt', utils.randomSecureToken(32));
        await options.setOption('password_derived_key_salt', utils.randomSecureToken(32));

        const passwordVerificationKey = utils.toBase64(await my_scrypt.getVerificationHash(password));
        await options.setOption('password_verification_hash', passwordVerificationKey);

        await password_encryption.setDataKey(password, utils.randomSecureToken(16));
    });

    sql.setDbReadyAsResolved();

    res.send({});
});

module.exports = router;