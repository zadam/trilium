"use strict";

const migration = require('./migration');

async function checkAuth(req, res, next) {
    if (!req.session.loggedIn) {
        res.redirect("login");
    }

    if (await migration.isDbUpToDate()) {
        next();
    }
    else {
        res.redirect("migration");
    }
}

async function checkAuthWithoutMigration(req, res, next) {
    if (!req.session.loggedIn) {
        res.redirect("login");
    }
    else {
        next();
    }
}

async function checkApiAuth(req, res, next) {
    if (!req.session.loggedIn && req.header("auth") !== "sync") {
        res.sendStatus(401);
    }

    if (await migration.isDbUpToDate()) {
        next();
    }
    else {
        res.sendStatus(409); // need better response than that
    }
}

async function checkApiAuthWithoutMigration(req, res, next) {
    if (!req.session.loggedIn && req.header("auth") !== "sync") {
        res.sendStatus(401);
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