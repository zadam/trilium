"use strict";

const protected_session = require('./protected_session');

module.exports = function(req) {
    function isProtectedSessionAvailable() {
        return protected_session.isProtectedSessionAvailable(req);
    }

    function getDataKey() {
        if (!isProtectedSessionAvailable()) {
            throwError("Protected session is not available");
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
        isProtectedSessionAvailable,
        getDataKey,
        getDataKeyOrNull
    };
};