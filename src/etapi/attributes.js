const becca = require("../becca/becca");
const ru = require("./route_utils");
const mappers = require("./mappers");
const attributeService = require("../services/attributes");
const validators = require("./validators.js");

function register(router) {
    ru.route(router, 'get', '/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = ru.getAndCheckAttribute(req.params.attributeId);

        res.json(mappers.mapAttributeToPojo(attribute));
    });

    ru.route(router, 'post' ,'/etapi/attributes', (req, res, next) => {
        const params = req.body;

        ru.getAndCheckNote(params.noteId);

        if (params.type === 'relation') {
            ru.getAndCheckNote(params.value);
        }

        if (params.type !== 'relation' && params.type !== 'label') {
            throw new ru.EtapiError(400, ru.GENERIC_CODE, `Only "relation" and "label" are supported attribute types, "${params.type}" given.`);
        }

        try {
            const attr = attributeService.createAttribute(params);

            res.json(mappers.mapAttributeToPojo(attr));
        }
        catch (e) {
            throw new ru.EtapiError(400, ru.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'value': validators.isString
    };

    ru.route(router, 'patch' ,'/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = ru.getAndCheckAttribute(req.params.attributeId);

        ru.validateAndPatch(attribute, req.body, ALLOWED_PROPERTIES_FOR_PATCH);

        res.json(mappers.mapAttributeToPojo(attribute));
    });

    ru.route(router, 'delete' ,'/etapi/attributes/:attributeId', (req, res, next) => {
        const attribute = becca.getAttribute(req.params.attributeId);

        if (!attribute) {
            return res.sendStatus(204);
        }

        attribute.markAsDeleted();

        res.sendStatus(204);
    });
}

module.exports = {
    register
};