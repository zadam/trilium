"use strict";

const utils = require('./utils');
const session = {};

function setDataKey(req, decryptedDataKey) {
    session.decryptedDataKey = Array.from(decryptedDataKey); // can't store buffer in session
    session.protectedSessionId = utils.randomSecureToken(32);

    return session.protectedSessionId;
}

function getProtectedSessionId(req) {
    return req.headers['x-protected-session-id'];
}

function getDataKey(req) {
    const protectedSessionId = getProtectedSessionId(req);

    if (protectedSessionId && session.protectedSessionId === protectedSessionId) {
        return session.decryptedDataKey;
    }
    else {
        return null;
    }
}

function isProtectedSessionAvailable(req) {
    const protectedSessionId = getProtectedSessionId(req);

    return protectedSessionId && session.protectedSessionId === protectedSessionId;
}

module.exports = {
    setDataKey,
    getDataKey,
    isProtectedSessionAvailable
};