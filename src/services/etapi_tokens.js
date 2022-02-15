const becca = require("../becca/becca");
const utils = require("./utils");
const EtapiToken = require("../becca/entities/etapi_token");
const crypto = require("crypto");

function getTokens() {
    return becca.getEtapiTokens();
}

function getTokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('base64');
}

function createToken(tokenName) {
    const token = utils.randomSecureToken(32);
    const tokenHash = getTokenHash(token);

    const etapiToken = new EtapiToken({
        name: tokenName,
        tokenHash
    }).save();

    return {
        authToken: `${etapiToken.etapiTokenId}_${token}`
    };
}

function parseAuthToken(auth) {
    if (!auth) {
        return null;
    }

    const chunks = auth.split("_");

    if (chunks.length === 1) {
        return { token: auth }; // legacy format without etapiTokenId
    }
    else if (chunks.length === 2) {
        return {
            etapiTokenId: chunks[0],
            token: chunks[1]
        }
    }
    else {
        return null; // wrong format
    }
}

function isValidAuthHeader(auth) {
    const parsed = parseAuthToken(auth);

    if (!parsed) {
        return false;
    }

    const authTokenHash = getTokenHash(parsed.token);

    if (parsed.etapiTokenId) {
        const etapiToken = becca.getEtapiToken(parsed.etapiTokenId);

        if (!etapiToken) {
            return false;
        }

        return etapiToken.tokenHash === authTokenHash;
    }
    else {
        for (const etapiToken of becca.getEtapiTokens()) {
            if (etapiToken.tokenHash === authTokenHash) {
                return true;
            }
        }

        return false;
    }
}

function renameToken(etapiTokenId, newName) {
    const etapiToken = becca.getEtapiToken(etapiTokenId);

    if (!etapiToken) {
        throw new Error(`Token ${etapiTokenId} does not exist`);
    }

    etapiToken.name = newName;
    etapiToken.save();
}

function deleteToken(etapiTokenId) {
    const etapiToken = becca.getEtapiToken(etapiTokenId);

    if (!etapiToken) {
        return; // ok, already deleted
    }

    etapiToken.markAsDeletedSimple();
}

module.exports = {
    getTokens,
    createToken,
    renameToken,
    deleteToken,
    parseAuthToken,
    isValidAuthHeader
};
