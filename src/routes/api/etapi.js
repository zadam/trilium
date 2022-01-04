const becca = require("../../becca/becca");
const utils = require("../../services/utils");
const noteService = require("../../services/notes");
const attributeService = require("../../services/attributes");
const Branch = require("../../becca/entities/branch");
const cls = require("../../services/cls.js");
const sql = require("../../services/sql.js");
const log = require("../../services/log.js");
const entityChangesService = require("../../services/entity_changes.js");
const sqlInit = require("../../services/sql_init.js");
const passwordService = require("../../services/password.js");

const GENERIC_CODE = "GENERIC";

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

function sendNoteNotFoundError(res, noteId) {
    return sendError(res, 404, "NOTE_NOT_FOUND",`Note ${noteId} not found`);
}

function sendBranchNotFoundError(res, branchId) {
    return sendError(res, 404, "BRANCH_NOT_FOUND",`Branch ${branchId} not found`);
}

function sendAttributeNotFoundError(res, attributeId) {
    return sendError(res, 404, "ATTRIBUTE_NOT_FOUND",`Attribute ${attributeId} not found`);
}

// TODO:
// * add date/month/year functions

function checkEtapiAuth(req, res, next) {
    if (false) {
        sendError(res, 401, "NOT_AUTHENTICATED", "Not authenticated");
    }
    else {
        next();
    }
}

function register(router) {
    function route(method, path, routeHandler) {
        router[method](path, checkEtapiAuth, (req, res, next) => {
            try {
                cls.namespace.bindEmitter(req);
                cls.namespace.bindEmitter(res);

                cls.init(() => {
                    cls.set('sourceId', "etapi");
                    cls.set('localNowDateTime', req.headers['trilium-local-now-datetime']);

                    const cb = () => routeHandler(req, res, next);

                    return sql.transactional(cb);
                });
            }
            catch (e) {
                log.error(`${method} ${path} threw exception: ` + e.stack);

                res.status(500).send(e.message);
            }
        });
    }

    route('get', '/etapi/notes/:noteId', (req, res, next) => {
        const {noteId} = req.params;
        const note = becca.getNote(noteId);

        if (!note) {
            return sendNoteNotFoundError(res, noteId);
        }

        res.json(mapNoteToPojo(note));
    });

    route('get', '/etapi/notes/:noteId/content', (req, res, next) => {
        const {noteId} = req.params;
        const note = becca.getNote(noteId);

        if (!note) {
            return sendNoteNotFoundError(res, noteId);
        }

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    route('get', '/etapi/branches/:branchId', (req, res, next) => {
        const {branchId} = req.params;
        const branch = becca.getBranch(branchId);

        if (!branch) {
            return sendBranchNotFoundError(res, branchId);
        }

        res.json(mapBranchToPojo(branch));
    });

    route('get', '/etapi/attributes/:attributeId', (req, res, next) => {
        const {attributeId} = req.params;
        const attribute = becca.getAttribute(attributeId);

        if (!attribute) {
            return sendAttributeNotFoundError(res, attributeId);
        }

        res.json(mapAttributeToPojo(attribute));
    });

    route('post' ,'/etapi/notes', (req, res, next) => {
        const params = req.body;

        if (!becca.getNote(params.parentNoteId)) {
            return sendNoteNotFoundError(res, params.parentNoteId);
        }

        try {
            const resp = noteService.createNewNote(params);

            res.json({
                note: mapNoteToPojo(resp.note),
                branch: mapBranchToPojo(resp.branch)
            });
        }
        catch (e) {
            return sendError(res, 400, GENERIC_CODE, e.message);
        }
    });

    route('post' ,'/etapi/branches', (req, res, next) => {
        const params = req.body;

        if (!becca.getNote(params.noteId)) {
            return sendNoteNotFoundError(res, params.noteId);
        }

        if (!becca.getNote(params.parentNoteId)) {
            return sendNoteNotFoundError(res, params.parentNoteId);
        }

        const existing = becca.getBranchFromChildAndParent(params.noteId, params.parentNoteId);

        if (existing) {
            existing.notePosition = params.notePosition;
            existing.prefix = params.prefix;
            existing.save();

            return res.json(mapBranchToPojo(existing));
        }

        try {
            const branch = new Branch(params).save();

            res.json(mapBranchToPojo(branch));
        }
        catch (e) {
            return sendError(res, 400, GENERIC_CODE, e.message);
        }
    });

    route('post' ,'/etapi/attributes', (req, res, next) => {
        const params = req.body;

        if (!becca.getNote(params.noteId)) {
            return sendNoteNotFoundError(res, params.noteId);
        }

        if (params.type === 'relation' && !becca.getNote(params.value)) {
            return sendNoteNotFoundError(res, params.value);
        }

        if (params.type !== 'relation' && params.type !== 'label') {
            return sendError(res, 400, GENERIC_CODE, `Only "relation" and "label" are supported attribute types, "${params.type}" given.`);
        }

        try {
            const attr = attributeService.createAttribute(params);

            res.json(mapAttributeToPojo(attr));
        }
        catch (e) {
            return sendError(res, 400, GENERIC_CODE, e.message);
        }
    });
}

function mapNoteToPojo(note) {
    return {
        noteId: note.noteId,
        isProtected: note.isProtected,
        title: note.title,
        type: note.type,
        mime: note.mime,
        dateCreated: note.dateCreated,
        dateModified: note.dateModified,
        utcDateCreated: note.utcDateCreated,
        utcDateModified: note.utcDateModified,
        parentNoteIds: note.getParentNotes().map(p => p.noteId),
        childNoteIds: note.getChildNotes().map(ch => ch.noteId),
        parentBranchIds: note.getParentBranches().map(p => p.branchId),
        childBranchIds: note.getChildBranches().map(ch => ch.branchId),
        attributes: note.getAttributes().map(attr => mapAttributeToPojo(attr))
    };
}

function mapBranchToPojo(branch) {
    return {
        branchId: branch.branchId,
        noteId: branch.noteId,
        parentNoteId: branch.parentNoteId,
        prefix: branch.prefix,
        notePosition: branch.notePosition,
        isExpanded: branch.isExpanded,
        utcDateModified: branch.utcDateModified
    };
}

function mapAttributeToPojo(attr) {
    return {
        attributeId: attr.attributeId,
        noteId: attr.noteId,
        type: attr.type,
        name: attr.name,
        value: attr.value,
        position: attr.position,
        isInheritable: attr.isInheritable,
        utcDateModified: attr.utcDateModified
    };
}

module.exports = {
    register
}
