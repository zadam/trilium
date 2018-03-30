"use strict";

const options = require('../../services/options');
const utils = require('../../services/utils');
const source_id = require('../../services/source_id');
const password_encryption = require('../../services/password_encryption');
const protected_session = require('../../services/protected_session');
const app_info = require('../../services/app_info');

async function loginSync(req) {
    const timestampStr = req.body.timestamp;

    const timestamp = utils.parseDateTime(timestampStr);

    const now = new Date();

    if (Math.abs(timestamp.getTime() - now.getTime()) > 5000) {
        return [400, { message: 'Auth request time is out of sync' }];
    }

    const dbVersion = req.body.dbVersion;

    if (dbVersion !== app_info.db_version) {
        return [400, { message: 'Non-matching db versions, local is version ' + app_info.db_version }];
    }

    const documentSecret = await options.getOption('document_secret');
    const expectedHash = utils.hmac(documentSecret, timestampStr);

    const givenHash = req.body.hash;

    if (expectedHash !== givenHash) {
        return [400, { message: "Sync login hash doesn't match" }];
    }

    req.session.loggedIn = true;

    return {
        sourceId: source_id.getCurrentSourceId()
    };
}

async function loginToProtectedSession(req) {
    const password = req.body.password;

    if (!await password_encryption.verifyPassword(password)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const decryptedDataKey = await password_encryption.getDataKey(password);

    const protectedSessionId = protected_session.setDataKey(req, decryptedDataKey);

    return {
        success: true,
        protectedSessionId: protectedSessionId
    };
}

module.exports = {
    loginSync,
    loginToProtectedSession
};