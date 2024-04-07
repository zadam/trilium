"use strict";

import etapiTokenService = require('./etapi_tokens');
import log = require('./log');
import sqlInit = require('./sql_init');
import utils = require('./utils');
import passwordEncryptionService = require('./encryption/password_encryption');
import config = require('./config');
import passwordService = require('./encryption/password');
import type { NextFunction, Request, Response } from 'express';
import { AppRequest } from '../routes/route-interface';

const noAuthentication = config.General && config.General.noAuthentication === true;

function checkAuth(req: AppRequest, res: Response, next: NextFunction) {
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
//  currently, we're doing that for file upload because handling form data seems to be difficult
function checkApiAuthOrElectron(req: AppRequest, res: Response, next: NextFunction) {
    if (!req.session.loggedIn && !utils.isElectron() && !noAuthentication) {
        reject(req, res, "Logged in session not found");
    }
    else {
        next();
    }
}

function checkApiAuth(req: AppRequest, res: Response, next: NextFunction) {
    if (!req.session.loggedIn && !noAuthentication) {
        reject(req, res, "Logged in session not found");
    }
    else {
        next();
    }
}

function checkAppInitialized(req: AppRequest, res: Response, next: NextFunction) {
    if (!sqlInit.isDbInitialized()) {
        res.redirect("setup");
    }
    else {
        next();
    }
}

function checkPasswordSet(req: AppRequest, res: Response, next: NextFunction) {
    if (!utils.isElectron() && !passwordService.isPasswordSet()) {
        res.redirect("set-password");
    } else {
        next();
    }
}

function checkPasswordNotSet(req: AppRequest, res: Response, next: NextFunction) {
    if (!utils.isElectron() && passwordService.isPasswordSet()) {
        res.redirect("login");
    } else {
        next();
    }
}

function checkAppNotInitialized(req: AppRequest, res: Response, next: NextFunction) {
    if (sqlInit.isDbInitialized()) {
        reject(req, res, "App already initialized.");
    }
    else {
        next();
    }
}

function checkEtapiToken(req: AppRequest, res: Response, next: NextFunction) {
    if (etapiTokenService.isValidAuthHeader(req.headers.authorization)) {
        next();
    }
    else {
        reject(req, res, "Token not found");
    }
}

function reject(req: AppRequest, res: Response, message: string) {
    log.info(`${req.method} ${req.path} rejected with 401 ${message}`);

    res.setHeader("Content-Type", "text/plain")
        .status(401)
        .send(message);
}

function checkCredentials(req: AppRequest, res: Response, next: NextFunction) {
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
    const auth = Buffer.from(header, 'base64').toString();
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

export = {
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
