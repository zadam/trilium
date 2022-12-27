const becca = require("../becca/becca");
const eu = require("./etapi_utils");
const mappers = require("./mappers");
const Branch = require("../becca/entities/branch");
const entityChangesService = require("../services/entity_changes");
const v = require("./validators");

function register(router) {
    eu.route(router, 'get', '/etapi/branches/:branchId', (req, res, next) => {
        const branch = eu.getAndCheckBranch(req.params.branchId);

        res.json(mappers.mapBranchToPojo(branch));
    });

    const ALLOWED_PROPERTIES_FOR_CREATE_BRANCH = {
        'branchId': [v.mandatory, v.notNull, v.isValidEntityId],
        'noteId': [v.mandatory, v.notNull, v.isNoteId],
        'parentNoteId': [v.mandatory, v.notNull, v.isNoteId],
        'notePosition': [v.notNull, v.isInteger],
        'prefix': [v.isString],
        'isExpanded': [v.notNull, v.isBoolean]
    };

    eu.route(router, 'post' ,'/etapi/branches', (req, res, next) => {
        const params = {};

        eu.validateAndPatch(params, req.body, ALLOWED_PROPERTIES_FOR_CREATE_BRANCH);

        const existing = becca.getBranchFromChildAndParent(params.noteId, params.parentNoteId);

        if (existing) {
            existing.notePosition = params.notePosition;
            existing.prefix = params.prefix;
            existing.isExpanded = params.isExpanded;
            existing.save();

            return res.status(200).json(mappers.mapBranchToPojo(existing));
        } else {
            try {
                const branch = new Branch(params).save();

                res.status(201).json(mappers.mapBranchToPojo(branch));
            } catch (e) {
                throw new eu.EtapiError(400, eu.GENERIC_CODE, e.message);
            }
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'notePosition': [v.notNull, v.isInteger],
        'prefix': [v.isString],
        'isExpanded': [v.notNull, v.isBoolean]
    };

    eu.route(router, 'patch' ,'/etapi/branches/:branchId', (req, res, next) => {
        const branch = eu.getAndCheckBranch(req.params.branchId);

        eu.validateAndPatch(branch, req.body, ALLOWED_PROPERTIES_FOR_PATCH);
        branch.save();

        res.json(mappers.mapBranchToPojo(branch));
    });

    eu.route(router, 'delete' ,'/etapi/branches/:branchId', (req, res, next) => {
        const branch = becca.getBranch(req.params.branchId);

        if (!branch || branch.isDeleted) {
            return res.sendStatus(204);
        }

        branch.deleteBranch();

        res.sendStatus(204);
    });

    eu.route(router, 'post' ,'/etapi/refresh-note-ordering/:parentNoteId', (req, res, next) => {
        eu.getAndCheckNote(req.params.parentNoteId);

        entityChangesService.addNoteReorderingEntityChange(req.params.parentNoteId, "etapi");

        res.sendStatus(204);
    });
}

module.exports = {
    register
};
