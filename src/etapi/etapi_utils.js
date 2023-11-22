const cls = require('../services/cls.js');
const sql = require('../services/sql.js');
const log = require('../services/log.js');
const becca = require('../becca/becca.js');
const etapiTokenService = require('../services/etapi_tokens.js');
const config = require('../services/config.js');
const GENERIC_CODE = "GENERIC";

const noAuthentication = config.General && config.General.noAuthentication === true;

class EtapiError extends Error {
    constructor(statusCode, code, message) {
        super();

        this.statusCode = statusCode;
        this.code = code;
        this.message = message;
    }
}

function sendError(res, statusCode, code, message) {
    return res
        .set('Content-Type', 'application/json')
        .status(statusCode)
        .send(JSON.stringify({
            "status": statusCode,
            "code": code,
            "message": message
        }));
}

function checkEtapiAuth(req, res, next) {
    if (noAuthentication || etapiTokenService.isValidAuthHeader(req.headers.authorization)) {
        next();
    }
    else {
        sendError(res, 401, "NOT_AUTHENTICATED", "Not authenticated");
    }
}

function processRequest(req, res, routeHandler, next, method, path) {
    try {
        cls.namespace.bindEmitter(req);
        cls.namespace.bindEmitter(res);

        cls.init(() => {
            cls.set('componentId', "etapi");
            cls.set('localNowDateTime', req.headers['trilium-local-now-datetime']);

            const cb = () => routeHandler(req, res, next);

            return sql.transactional(cb);
        });
    } catch (e) {
        log.error(`${method} ${path} threw exception ${e.message} with stacktrace: ${e.stack}`);

        if (e instanceof EtapiError) {
            sendError(res, e.statusCode, e.code, e.message);
        } else {
            sendError(res, 500, GENERIC_CODE, e.message);
        }
    }
}

function route(router, method, path, routeHandler) {
    router[method](path, checkEtapiAuth, (req, res, next) => processRequest(req, res, routeHandler, next, method, path));
}

function NOT_AUTHENTICATED_ROUTE(router, method, path, middleware, routeHandler) {
    router[method](path, ...middleware, (req, res, next) => processRequest(req, res, routeHandler, next, method, path));
}

function getAndCheckNote(noteId) {
    const note = becca.getNote(noteId);

    if (note) {
        return note;
    }
    else {
        throw new EtapiError(404, "NOTE_NOT_FOUND", `Note '${noteId}' not found.`);
    }
}

function getAndCheckAttachment(attachmentId) {
    const attachment = becca.getAttachment(attachmentId, {includeContentLength: true});

    if (attachment) {
        return attachment;
    }
    else {
        throw new EtapiError(404, "ATTACHMENT_NOT_FOUND", `Attachment '${attachmentId}' not found.`);
    }
}

function getAndCheckBranch(branchId) {
    const branch = becca.getBranch(branchId);

    if (branch) {
        return branch;
    }
    else {
        throw new EtapiError(404, "BRANCH_NOT_FOUND", `Branch '${branchId}' not found.`);
    }
}

function getAndCheckAttribute(attributeId) {
    const attribute = becca.getAttribute(attributeId);

    if (attribute) {
        return attribute;
    }
    else {
        throw new EtapiError(404, "ATTRIBUTE_NOT_FOUND", `Attribute '${attributeId}' not found.`);
    }
}

function validateAndPatch(target, source, allowedProperties) {
    for (const key of Object.keys(source)) {
        if (!(key in allowedProperties)) {
            throw new EtapiError(400, "PROPERTY_NOT_ALLOWED", `Property '${key}' is not allowed for this method.`);
        }
        else {
            for (const validator of allowedProperties[key]) {
                const validationResult = validator(source[key]);

                if (validationResult) {
                    throw new EtapiError(400, "PROPERTY_VALIDATION_ERROR", `Validation failed on property '${key}': ${validationResult}.`);
                }
            }
        }
    }

    // validation passed, let's patch
    for (const propName of Object.keys(source)) {
        target[propName] = source[propName];
    }
}

module.exports = {
    EtapiError,
    sendError,
    route,
    NOT_AUTHENTICATED_ROUTE,
    GENERIC_CODE,
    validateAndPatch,
    getAndCheckNote,
    getAndCheckBranch,
    getAndCheckAttribute,
    getAndCheckAttachment
}
