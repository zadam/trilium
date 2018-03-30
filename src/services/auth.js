"use strict";

const migration = require('./migration');
const sql = require('./sql');
const utils = require('./utils');

async function checkAuth(req, res, next) {
    if (!await sql.isUserInitialized()) {
        res.redirect("setup");
    }
    else if (!req.session.loggedIn && !utils.isElectron()) {
        res.redirect("login");
    }
    else if (!await sql.isDbUpToDate()) {
        res.redirect("migration");
    }
    else {
        next();
    }
}

async function checkAuthForMigrationPage(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
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
    else if (await sql.isDbUpToDate()) {
        next();
    }
    else {
        res.status(409).send("Mismatched app versions"); // need better response than that
    }
}

async function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.status(401).send("Not authorized");
    }
    else if (await sql.isDbUpToDate()) {
        next();
    }
    else {
        res.status(409).send("Mismatched app versions"); // need better response than that
    }
}

async function checkApiAuthForMigrationPage(req, res, next) {
    if (!req.session.loggedIn) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

async function checkAppNotInitialized(req, res, next) {
    if (await sql.isUserInitialized()) {
        res.status(400).send("App already initialized.");
    }
    else {
        next();
    }
}

async function checkSenderToken(req, res, next) {
    const token = req.headers.authorization;

    if (await sql.getValue("SELECT COUNT(*) FROM api_tokens WHERE isDeleted = 0 AND token = ?", [token]) === 0) {
        res.status(401).send("Not authorized");
    }
    else if (await sql.isDbUpToDate()) {
        next();
    }
    else {
        res.status(409).send("Mismatched app versions"); // need better response than that
    }
}

module.exports = {
    checkAuth,
    checkAuthForMigrationPage,
    checkApiAuth,
    checkApiAuthForMigrationPage,
    checkAppNotInitialized,
    checkApiAuthOrElectron,
    checkSenderToken
};