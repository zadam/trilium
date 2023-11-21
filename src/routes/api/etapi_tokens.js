import etapiTokenService from '../../services/etapi_tokens.js'

function getTokens() {
    const tokens = etapiTokenService.getTokens();

    tokens.sort((a, b) => a.utcDateCreated < b.utcDateCreated ? -1 : 1);

    return tokens;
}

function createToken(req) {
    return etapiTokenService.createToken(req.body.tokenName);
}

function patchToken(req) {
    etapiTokenService.renameToken(req.params.etapiTokenId, req.body.name);
}

function deleteToken(req) {
    etapiTokenService.deleteToken(req.params.etapiTokenId);
}

export default {
    getTokens,
    createToken,
    patchToken,
    deleteToken
};
