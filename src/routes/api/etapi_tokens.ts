import { Request } from 'express';
import etapiTokenService = require('../../services/etapi_tokens');

function getTokens() {
    const tokens = etapiTokenService.getTokens();

    tokens.sort((a, b) => a.utcDateCreated < b.utcDateCreated ? -1 : 1);

    return tokens;
}

function createToken(req: Request) {
    return etapiTokenService.createToken(req.body.tokenName);
}

function patchToken(req: Request) {
    etapiTokenService.renameToken(req.params.etapiTokenId, req.body.name);
}

function deleteToken(req: Request) {
    etapiTokenService.deleteToken(req.params.etapiTokenId);
}

export = {
    getTokens,
    createToken,
    patchToken,
    deleteToken
};
