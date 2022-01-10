const becca = require("../becca/becca");
const eu = require("./etapi_utils");
const mappers = require("./mappers");
const attributeService = require("../services/attributes");
const validators = require("./validators");

function register(router) {
    eu.route(router, 'get', '/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = eu.getAndCheckAttribute(req.params.attributeId);

        res.json(mappers.mapAttributeToPojo(attribute));
    });

    eu.route(router, 'post' ,'/etapi/attributes', (req, res, next) => {
        const params = req.body;

        eu.getAndCheckNote(params.noteId);

        if (params.type === 'relation') {
            eu.getAndCheckNote(params.value);
        }

        if (params.type !== 'relation' && params.type !== 'label') {
            throw new eu.EtapiError(400, eu.GENERIC_CODE, `Only "relation" and "label" are supported attribute types, "${params.type}" given.`);
        }

        try {
            const attr = attributeService.createAttribute(params);

            res.json(mappers.mapAttributeToPojo(attr));
        }
        catch (e) {
            throw new eu.EtapiError(400, eu.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'value': validators.isString
    };

    eu.route(router, 'patch' ,'/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = eu.getAndCheckAttribute(req.params.attributeId);

        eu.validateAndPatch(attribute, req.body, ALLOWED_PROPERTIES_FOR_PATCH);

        res.json(mappers.mapAttributeToPojo(attribute));
    });

    eu.route(router, 'delete' ,'/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = becca.getAttribute(req.params.attributeId);

        if (!attribute || attribute.isDeleted) {
            return res.sendStatus(204);
        }

        attribute.markAsDeleted();

        res.sendStatus(204);
    });
}

module.exports = {
    register
};
