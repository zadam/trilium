const utils = require('./utils');

function setDataKey(req, decryptedDataKey) {
    req.session.decryptedDataKey = decryptedDataKey;
    req.session.protectedSessionId = utils.randomSecureToken(32);

    return req.session.protectedSessionId;
}

function getDataKey(req, protectedSessionId) {
    if (protectedSessionId && req.session.protectedSessionId === protectedSessionId) {
        return req.session.decryptedDataKey;
    }
    else {
        return null;
    }
}

module.exports = {
    setDataKey,
    getDataKey
};