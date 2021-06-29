"use strict";

const options = require('../../services/options');
const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const sourceIdService = require('../../services/source_id');
const passwordEncryptionService = require('../../services/password_encryption');
const protectedSessionService = require('../../services/protected_session');
const appInfo = require('../../services/app_info');
const eventService = require('../../services/events');
const sqlInit = require('../../services/sql_init');
const sql = require('../../services/sql');
const optionService = require('../../services/options');
const ApiToken = require('../../becca/entities/api_token');
const ws = require("../../services/ws");

function loginSync(req) {
    if (!sqlInit.schemaExists()) {
        return [500, { message: "DB schema does not exist, can't sync." }];
    }

    const timestampStr = req.body.timestamp;

    const timestamp = dateUtils.parseDateTime(timestampStr);

    const now = new Date();

    // login token is valid for 5 minutes
    if (Math.abs(timestamp.getTime() - now.getTime()) > 5 * 60 * 1000) {
        return [401, { message: 'Auth request time is out of sync, please check that both client and server have correct time.' }];
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
        sourceId: sourceIdService.getCurrentSourceId(),
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

function token(req) {
    const username = req.body.username;
    const password = req.body.password;

    const isUsernameValid = username === optionService.getOption('username');
    const isPasswordValid = passwordEncryptionService.verifyPassword(password);

    if (!isUsernameValid || !isPasswordValid) {
        return [401, "Incorrect username/password"];
    }

    const apiToken = new ApiToken({
        token: utils.randomSecureToken()
    }).save();

    return {
        token: apiToken.token
    };
}

module.exports = {
    loginSync,
    loginToProtectedSession,
    logoutFromProtectedSession,
    token
};
