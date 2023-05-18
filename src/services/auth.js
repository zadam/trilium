"use strict";

const etapiTokenService = require("./etapi_tokens");
const log = require('./log');
const sqlInit = require('./sql_init');
const utils = require('./utils');
const passwordEncryptionService = require('./password_encryption');
const config = require('./config');
const passwordService = require("./password");

const noAuthentication = config.General && config.General.noAuthentication === true;

function checkAuth(req, res, next) {
    if (!sqlInit.isDbInitialized()) {
        res.redirect("setup");
    }
    else if (!req.session.loggedIn && !utils.isElectron() && !noAuthentication) {
        res.redirect("login");
    }
    else {
        next();
    }
}

// for electron things which need network stuff
// currently we're doing that for file upload because handling form data seems to be difficult
function checkApiAuthOrElectron(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron() && !noAuthentication) {
        reject(req, res, "Logged in session not found");
    }
    else {
        next();
    }
}

function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn && !noAuthentication) {
        reject(req, res, "Logged in session not found");
    }
    else {
        next();
    }
}

function checkAppInitialized(req, res, next) {
    if (!sqlInit.isDbInitialized()) {
        res.redirect("setup");
    }
    else {
        next();
    }
}

function checkPasswordSet(req, res, next) {
    if (!utils.isElectron() && !passwordService.isPasswordSet()) {
        res.redirect("set-password");
    } else {
        next();
    }
}

function checkPasswordNotSet(req, res, next) {
    if (!utils.isElectron() && passwordService.isPasswordSet()) {
        res.redirect("login");
    } else {
        next();
    }
}

function checkAppNotInitialized(req, res, next) {
    if (sqlInit.isDbInitialized()) {
        reject(req, res, "App already initialized.");
    }
    else {
        next();
    }
}

function checkEtapiToken(req, res, next) {
    if (etapiTokenService.isValidAuthHeader(req.headers.authorization)) {
        next();
    }
    else {
        reject(req, res, "Token not found");
    }
}

function reject(req, res, message) {
    log.info(`${req.method} ${req.path} rejected with 401 ${message}`);

    res.setHeader("Content-Type", "text/plain")
        .status(401)
        .send(message);
}

function checkCredentials(req, res, next) {
    if (!sqlInit.isDbInitialized()) {
        res.setHeader("Content-Type", "text/plain")
            .status(400)
            .send('Database is not initialized yet.');
        return;
    }

    if (!passwordService.isPasswordSet()) {
        res.setHeader("Content-Type", "text/plain")
            .status(400)
            .send('Password has not been set yet. Please set a password and repeat the action');
        return;
    }

    const header = req.headers['trilium-cred'] || '';
    const auth = new Buffer.from(header, 'base64').toString();
    const colonIndex = auth.indexOf(':');
    const password = colonIndex === -1 ? "" : auth.substr(colonIndex + 1);
    // username is ignored

    if (!passwordEncryptionService.verifyPassword(password)) {
        res.setHeader("Content-Type", "text/plain")
            .status(401)
            .send('Incorrect password');
    }
    else {
        next();
    }
}

module.exports = {
    checkAuth,
    checkApiAuth,
    checkAppInitialized,
    checkPasswordSet,
    checkPasswordNotSet,
    checkAppNotInitialized,
    checkApiAuthOrElectron,
    checkEtapiToken,
    checkCredentials
};
