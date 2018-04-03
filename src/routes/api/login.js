"use strict";

const options = require('../../services/options');
const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const sourceIdService = require('../../services/source_id');
const passwordEncryptionService = require('../../services/password_encryption');
const protectedSessionService = require('../../services/protected_session');
const appInfo = require('../../services/app_info');

async function loginSync(req) {
    const timestampStr = req.body.timestamp;

    const timestamp = dateUtils.parseDateTime(timestampStr);

    const now = new Date();

    if (Math.abs(timestamp.getTime() - now.getTime()) > 5000) {
        return [400, { message: 'Auth request time is out of sync' }];
    }

    const dbVersion = req.body.dbVersion;

    if (dbVersion !== appInfo.dbVersion) {
        return [400, { message: 'Non-matching db versions, local is version ' + appInfo.dbVersion }];
    }

    const documentSecret = await options.getOption('documentSecret');
    const expectedHash = utils.hmac(documentSecret, timestampStr);

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        return [400, { message: "Sync login hash doesn't match" }];
    }

    req.session.loggedIn = true;

    return {
        sourceId: sourceIdService.getCurrentSourceId()
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

    const protectedSessionId = protectedSessionService.setDataKey(req, decryptedDataKey);

    return {
        success: true,
        protectedSessionId: protectedSessionId
    };
}

module.exports = {
    loginSync,
    loginToProtectedSession
};