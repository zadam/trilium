const becca = require("../becca/becca");
const eu = require("./etapi_utils");
const mappers = require("./mappers");
const Branch = require("../becca/entities/branch");
const noteService = require("../services/notes");
const TaskContext = require("../services/task_context");
const entityChangesService = require("../services/entity_changes");
const validators = require("./validators");

function register(router) {
    eu.route(router, 'get', '/etapi/branches/:branchId', (req, res, next) => {
        const branch = eu.getAndCheckBranch(req.params.branchId);

        res.json(mappers.mapBranchToPojo(branch));
    });

    eu.route(router, 'post' ,'/etapi/branches', (req, res, next) => {
        const params = req.body;

        eu.getAndCheckNote(params.noteId);
        eu.getAndCheckNote(params.parentNoteId);

        const existing = becca.getBranchFromChildAndParent(params.noteId, params.parentNoteId);

        if (existing) {
            existing.notePosition = params.notePosition;
            existing.prefix = params.prefix;
            existing.save();

            return res.json(mappers.mapBranchToPojo(existing));
        }

        try {
            const branch = new Branch(params).save();

            res.json(mappers.mapBranchToPojo(branch));
        }
        catch (e) {
            throw new eu.EtapiError(400, eu.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'notePosition': validators.isInteger,
        'prefix': validators.isStringOrNull,
        'isExpanded': validators.isBoolean
    };

    eu.route(router, 'patch' ,'/etapi/branches/:branchId', (req, res, next) => {
        const branch = eu.getAndCheckBranch(req.params.branchId);

        eu.validateAndPatch(branch, req.body, ALLOWED_PROPERTIES_FOR_PATCH);

        res.json(mappers.mapBranchToPojo(branch));
    });

    eu.route(router, 'delete' ,'/etapi/branches/:branchId', (req, res, next) => {
        const branch = becca.getBranch(req.params.branchId);

        if (!branch || branch.isDeleted) {
            return res.sendStatus(204);
        }

        noteService.deleteBranch(branch, null, new TaskContext('no-progress-reporting'));

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
