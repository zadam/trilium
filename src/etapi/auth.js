const becca = require("../becca/becca");
const eu = require("./etapi_utils");
const passwordEncryptionService = require("../services/password_encryption");
const etapiTokenService = require("../services/etapi_tokens");

function register(router, loginMiddleware) {
    eu.NOT_AUTHENTICATED_ROUTE(router, 'post', '/etapi/auth/login', loginMiddleware, (req, res, next) => {
        const {password, tokenName} = req.body;

        if (!passwordEncryptionService.verifyPassword(password)) {
            throw new eu.EtapiError(401, "WRONG_PASSWORD", "Wrong password.");
        }

        const {authToken} = etapiTokenService.createToken(tokenName || "ETAPI login");

        res.status(201).json({
            authToken
        });
    });

    eu.route(router, 'post', '/etapi/auth/logout', (req, res, next) => {
        const parsed = etapiTokenService.parseAuthToken(req.headers.authorization);

        if (!parsed || !parsed.etapiTokenId) {
            throw new eu.EtapiError(400, eu.GENERIC_CODE, "Cannot logout this token.");
        }

        const etapiToken = becca.getEtapiToken(parsed.etapiTokenId);

        if (!etapiToken) {
            // shouldn't happen since this already passed auth validation
            throw new Error(`Cannot find the token ${parsed.etapiTokenId}.`);
        }

        etapiToken.markAsDeletedSimple();

        res.sendStatus(204);
    });
}

module.exports = {
    register
}
