"use strict";

const options = require('../../services/options');
const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const sourceIdService = require('../../services/source_id');
const passwordEncryptionService = require('../../services/password_encryption');
const protectedSessionService = require('../../services/protected_session');
const appInfo = require('../../services/app_info');
const eventService = require('../../services/events');
const cls = require('../../services/cls');
const sqlInit = require('../../services/sql_init');
const sql = require('../../services/sql');

async function loginSync(req) {
    if (!await sqlInit.schemaExists()) {
        return [400, { message: "DB schema does not exist, can't sync." }];
    }

    const timestampStr = req.body.timestamp;

    const timestamp = dateUtils.parseDateTime(timestampStr);

    const now = new Date();

    // login token is valid for 5 minutes
    if (Math.abs(timestamp.getTime() - now.getTime()) > 5 * 60 * 1000) {
        return [400, { message: 'Auth request time is out of sync' }];
    }

    const syncVersion = req.body.syncVersion;

    if (syncVersion !== appInfo.syncVersion) {
        return [400, { message: `Non-matching sync versions, local is version ${appInfo.syncVersion}, remote is ${syncVersion}` }];
    }

    const documentSecret = await options.getOption('documentSecret');
    const expectedHash = utils.hmac(documentSecret, timestampStr);

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        return [400, { message: "Sync login credentials are incorrect." }];
    }

    req.session.loggedIn = true;

    return {
        sourceId: sourceIdService.getCurrentSourceId(),
        maxSyncId: await sql.getValue("SELECT MAX(id) FROM sync")
    };
}

async function loginToProtectedSession(req) {
    const password = req.body.password;

    if (!await passwordEncryptionService.verifyPassword(password)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const decryptedDataKey = await passwordEncryptionService.getDataKey(password);

    const protectedSessionId = protectedSessionService.setDataKey(decryptedDataKey);

    // this is set here so that event handlers have access to the protected session
    cls.namespace.set('protectedSessionId', protectedSessionId);

    await eventService.emit(eventService.ENTER_PROTECTED_SESSION);

    return {
        success: true,
        protectedSessionId: protectedSessionId
    };
}

module.exports = {
    loginSync,
    loginToProtectedSession
};