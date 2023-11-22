"use strict";

const options = require('../../services/options.js');
const utils = require('../../services/utils.js');
const dateUtils = require('../../services/date_utils.js');
const instanceId = require('../../services/instance_id.js');
const passwordEncryptionService = require('../../services/encryption/password_encryption.js');
const protectedSessionService = require('../../services/protected_session.js');
const appInfo = require('../../services/app_info.js');
const eventService = require('../../services/events.js');
const sqlInit = require('../../services/sql_init.js');
const sql = require('../../services/sql.js');
const ws = require('../../services/ws.js');
const etapiTokenService = require('../../services/etapi_tokens.js');

function loginSync(req) {
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

function loginToProtectedSession(req) {
    const password = req.body.password;

    if (!passwordEncryptionService.verifyPassword(password)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const decryptedDataKey = passwordEncryptionService.getDataKey(password);

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

function token(req) {
    const password = req.body.password;

    if (!passwordEncryptionService.verifyPassword(password)) {
        return [401, "Incorrect password"];
    }

    // for backwards compatibility with Sender which does not send the name
    const tokenName = req.body.tokenName || "Trilium Sender / Web Clipper";

    const {authToken} = etapiTokenService.createToken(tokenName);

    return { token: authToken };
}

module.exports = {
    loginSync,
    loginToProtectedSession,
    logoutFromProtectedSession,
    touchProtectedSession,
    token
};
