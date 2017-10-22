"use strict";

const express = require('express');
const router = express.Router();
const utils = require('../services/utils');
const sql = require('../services/sql');
const my_scrypt = require('../services/my_scrypt');

router.get('', (req, res, next) => {
    res.render('login', { 'failedAuth': false });
});

router.post('', async (req, res, next) => {
    const userName = await sql.getOption('username');

    const guessedPassword = req.body.password;

    if (req.body.username === userName && await verifyPassword(guessedPassword)) {
        const rememberMe = req.body.remember_me;

        req.session.regenerate(() => {
            if (rememberMe) {
                req.session.cookie.maxAge = 21 * 24 * 3600000;  // 3 weeks
            } else {
                req.session.cookie.expires = false;
            }

            req.session.loggedIn = true;
            res.redirect('/');
        });
    }
    else {
        res.render('login', {'failedAuth': true});
    }
});


async function verifyPassword(guessed_password) {
    const hashed_password = utils.fromBase64(await sql.getOption('password_verification_hash'));

    const guess_hashed = await my_scrypt.getVerificationHash(guessed_password);

    return guess_hashed.equals(hashed_password);
}

module.exports = router;
