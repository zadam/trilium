"use strict";

const utils = require('../services/utils');
const optionService = require('../services/options');
const myScryptService = require('../services/my_scrypt');

function loginPage(req, res) {
    res.render('login', { failedAuth: false });
}

async function login(req, res) {
    const userName = await optionService.getOption('username');

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
            res.redirect('.');
        });
    }
    else {
        res.render('login', {'failedAuth': true});
    }
}

async function verifyPassword(guessedPassword) {
    const hashed_password = utils.fromBase64(await optionService.getOption('passwordVerificationHash'));

    const guess_hashed = await myScryptService.getVerificationHash(guessedPassword);

    return guess_hashed.equals(hashed_password);
}

function logout(req, res) {
    req.session.regenerate(() => {
        req.session.loggedIn = false;

        res.redirect('login');
    });

}

module.exports = {
    loginPage,
    login,
    logout
};
