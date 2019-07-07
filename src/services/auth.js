"use strict";

const sql = require('./sql');
const sqlInit = require('./sql_init');
const utils = require('./utils');
const passwordEncryptionService = require('./password_encryption');
const optionService = require('./options');

async function checkAuth(req, res, next) {
    if (!await sqlInit.isDbInitialized()) {
        res.redirect("setup");
    }
    else if (!req.session.loggedIn && !utils.isElectron()) {
        res.redirect("login");
    }
    else {
        next();
    }
}

// for electron things which need network stuff
// currently we're doing that for file upload because handling form data seems to be difficult
async function checkApiAuthOrElectron(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

async function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

async function checkAppInitialized(req, res, next) {
    if (!await sqlInit.isDbInitialized()) {
        res.redirect("setup");
    }
    else {
        next();
    }
}

async function checkAppNotInitialized(req, res, next) {
    if (await sqlInit.isDbInitialized()) {
        res.status(400).send("App already initialized.");
    }
    else {
        next();
    }
}

async function checkToken(req, res, next) {
    const token = req.headers.authorization;

    if (await sql.getValue("SELECT COUNT(*) FROM api_tokens WHERE isDeleted = 0 AND token = ?", [token]) === 0) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

async function checkBasicAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.split(/\s+/).pop() || '';
    const auth = new Buffer.from(token, 'base64').toString();
    const [username, password] = auth.split(/:/);

    const dbUsername = await optionService.getOption('username');

    if (dbUsername !== username || !await passwordEncryptionService.verifyPassword(password)) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

module.exports = {
    checkAuth,
    checkApiAuth,
    checkAppInitialized,
    checkAppNotInitialized,
    checkApiAuthOrElectron,
    checkToken,
    checkBasicAuth
};