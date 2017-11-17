"use strict";

const protected_session = require('./protected_session');

module.exports = function(req) {
    const browserId = req.headers['x-browser-id'];

    function isProtectedSessionAvailable() {
        return protected_session.isProtectedSessionAvailable(req);
    }

    function getDataKey() {
        if (!isProtectedSessionAvailable()) {
            throw new Error("Protected session is not available");
        }

        return protected_session.getDataKey(req);
    }

    function getDataKeyOrNull() {
        if (!isProtectedSessionAvailable()) {
            return null;
        }

        return protected_session.getDataKey(req);
    }

    return {
        browserId,
        isProtectedSessionAvailable,
        getDataKey,
        getDataKeyOrNull
    };
};