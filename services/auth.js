"use strict";

const migration = require('./migration');
const utils = require('./utils');
const options = require('./options');

async function checkAuth(req, res, next) {
    const username = await options.getOption('username');

    if (!username) {
        res.redirect("setup");
    }
    else if (!req.session.loggedIn && !utils.isElectron()) {
        res.redirect("login");
    }
    else if (!await migration.isDbUpToDate()) {
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

async function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.status(401).send("Not authorized");
    }
    else if (await migration.isDbUpToDate()) {
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
    const username = await options.getOption('username');

    if (username) {
        res.status(400).send("App already initialized.");
    }
    else {
        next();
    }
}

module.exports = {
    checkAuth,
    checkAuthForMigrationPage,
    checkApiAuth,
    checkApiAuthForMigrationPage,
    checkAppNotInitialized
};