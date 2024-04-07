"use strict";

import options = require('../../services/options');
import utils = require('../../services/utils');
import dateUtils = require('../../services/date_utils');
import instanceId = require('../../services/instance_id');
import passwordEncryptionService = require('../../services/encryption/password_encryption');
import protectedSessionService = require('../../services/protected_session');
import appInfo = require('../../services/app_info');
import eventService = require('../../services/events');
import sqlInit = require('../../services/sql_init');
import sql = require('../../services/sql');
import ws = require('../../services/ws');
import etapiTokenService = require('../../services/etapi_tokens');
import { Request } from 'express';
import { AppRequest } from '../route-interface';

function loginSync(req: AppRequest) {
    if (!sqlInit.schemaExists()) {
        return [500, { message: "DB schema does not exist, can't sync." }];
    }

    const timestampStr = req.body.timestamp;

    const timestamp = dateUtils.parseDateTime(timestampStr);

    const now = new Date();

    // login token is valid for 5 minutes
    if (Math.abs(timestamp.getTime() - now.getTime()) > 5 * 60 * 1000) {
        return [401, { message: 'Auth request time is out of sync, please check that both client and server have correct time. The difference between clocks has to be smaller than 5 minutes.' }];
    }

    const syncVersion = req.body.syncVersion;

    if (syncVersion !== appInfo.syncVersion) {
        return [400, { message: `Non-matching sync versions, local is version ${appInfo.syncVersion}, remote is ${syncVersion}. It is recommended to run same version of Trilium on both sides of sync.` }];
    }

    const documentSecret = options.getOption('documentSecret');
    const expectedHash = utils.hmac(documentSecret, timestampStr);

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        return [400, { message: "Sync login credentials are incorrect. It looks like you're trying to sync two different initialized documents which is not possible." }];
    }

    req.session.loggedIn = true;

    return {
        instanceId: instanceId,
        maxEntityChangeId: sql.getValue("SELECT COALESCE(MAX(id), 0) FROM entity_changes WHERE isSynced = 1")
    };
}

function loginToProtectedSession(req: Request) {
    const password = req.body.password;

    if (!passwordEncryptionService.verifyPassword(password)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const decryptedDataKey = passwordEncryptionService.getDataKey(password);
    if (!decryptedDataKey) {
        return {
            success: false,
            message: "Unable to obtain data key."
        }
    }

    protectedSessionService.setDataKey(decryptedDataKey);

    eventService.emit(eventService.ENTER_PROTECTED_SESSION);

    ws.sendMessageToAllClients({ type: 'protectedSessionLogin' });

    return {
        success: true
    };
}

function logoutFromProtectedSession() {
    protectedSessionService.resetDataKey();

    eventService.emit(eventService.LEAVE_PROTECTED_SESSION);

    ws.sendMessageToAllClients({ type: 'protectedSessionLogout' });
}

function touchProtectedSession() {
    protectedSessionService.touchProtectedSession();
}

function token(req: Request) {
    const password = req.body.password;

    if (!passwordEncryptionService.verifyPassword(password)) {
        return [401, "Incorrect password"];
    }

    // for backwards compatibility with Sender which does not send the name
    const tokenName = req.body.tokenName || "Trilium Sender / Web Clipper";

    const {authToken} = etapiTokenService.createToken(tokenName);

    return { token: authToken };
}

export = {
    loginSync,
    loginToProtectedSession,
    logoutFromProtectedSession,
    touchProtectedSession,
    token
};
