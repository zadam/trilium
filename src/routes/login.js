"use strict";

const utils = require('../services/utils.js');
const optionService = require('../services/options.js');
const myScryptService = require('../services/encryption/my_scrypt.js');
const log = require('../services/log.js');
const passwordService = require('../services/encryption/password.js');
const assetPath = require('../services/asset_path.js');
const appPath = require('../services/app_path.js');
const ValidationError = require('../errors/validation_error.js');

function loginPage(req, res) {
    res.render('login', {
        failedAuth: false,
        assetPath: assetPath,
        appPath: appPath
    });
}

function setPasswordPage(req, res) {
    res.render('set_password', {
        error: false,
        assetPath: assetPath,
        appPath: appPath
    });
}

function setPassword(req, res) {
    if (passwordService.isPasswordSet()) {
        throw new ValidationError("Password has been already set");
    }

    let {password1, password2} = req.body;
    password1 = password1.trim();
    password2 = password2.trim();

    let error;

    if (password1 !== password2) {
        error = "Entered passwords don't match.";
    } else if (password1.length < 4) {
        error = "Password must be at least 4 characters long.";
    }

    if (error) {
        res.render('set_password', {
            error,
            assetPath: assetPath
        });
        return;
    }

    passwordService.setPassword(password1);

    res.redirect('login');
}

function login(req, res) {
    const guessedPassword = req.body.password;

    if (verifyPassword(guessedPassword)) {
        const rememberMe = req.body.rememberMe;

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
        // note that logged IP address is usually meaningless since the traffic should come from a reverse proxy
        log.info(`WARNING: Wrong password from ${req.ip}, rejecting.`);

        res.status(401).render('login', {
            failedAuth: true,
            assetPath: assetPath
        });
    }
}

function verifyPassword(guessedPassword) {
    const hashed_password = utils.fromBase64(optionService.getOption('passwordVerificationHash'));

    const guess_hashed = myScryptService.getVerificationHash(guessedPassword);

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
    setPasswordPage,
    setPassword,
    login,
    logout
};
