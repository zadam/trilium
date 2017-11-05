"use strict";

const migration = require('./migration');
const utils = require('./utils');

async function checkAuth(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
        res.redirect("login");
    }
    else if (await migration.isDbUpToDate()) {
        next();
    }
    else {
        res.redirect("migration");
    }
}

async function checkAuthWithoutMigration(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
        res.redirect("login");
    }
    else {
        next();
    }
}

async function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
        res.status(401).send("Not authorized");
    }
    else if (await migration.isDbUpToDate()) {
        next();
    }
    else {
        res.status(409).send("Mismatched app versions"); // need better response than that
    }
}

async function checkApiAuthWithoutMigration(req, res, next) {
    if (!req.session.loggedIn && !utils.isElectron()) {
        res.status(401).send("Not authorized");
    }
    else {
        next();
    }
}

module.exports = {
    checkAuth,
    checkAuthWithoutMigration,
    checkApiAuth,
    checkApiAuthWithoutMigration
};