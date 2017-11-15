"use strict";

const utils = require('./utils');

function setDataKey(req, decryptedDataKey) {
    req.session.decryptedDataKey = decryptedDataKey;
    req.session.protectedSessionId = utils.randomSecureToken(32);

    return req.session.protectedSessionId;
}

function getProtectedSessionId(req) {
    return req.headers['x-protected-session-id'];
}

function getDataKey(req) {
    const protectedSessionId = getProtectedSessionId(req);

    if (protectedSessionId && req.session.protectedSessionId === protectedSessionId) {
        return req.session.decryptedDataKey;
    }
    else {
        return null;
    }
}

function isProtectedSessionAvailable(req) {
    const protectedSessionId = getProtectedSessionId(req);

    return protectedSessionId && req.session.protectedSessionId === protectedSessionId;
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable
};