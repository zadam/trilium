const becca = require("../../becca/becca");
const utils = require("../../services/utils");

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

function register(router) {
    router.get('/etapi/notes/:noteId', (req, res, next) => {
        const {noteId} = req.params;
        const note = becca.getNote(noteId);

        if (!note) {
            return sendNoteNotFoundError(res, noteId);
        }

        res.json({
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
        });
    });

    router.get('/etapi/notes/:noteId/content', (req, res, next) => {
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

    router.get('/etapi/branches/:branchId', (req, res, next) => {
        const {branchId} = req.params;
        const branch = becca.getBranch(branchId);

        if (!branch) {
            return sendBranchNotFoundError(res, branchId);
        }

        res.json({
            branchId: branch.branchId,
            noteId: branch.noteId,
            parentNoteId: branch.parentNoteId,
            prefix: branch.prefix,
            notePosition: branch.notePosition,
            isExpanded: branch.isExpanded,
            utcDateModified: branch.utcDateModified
        });
    });

    router.get('/etapi/attributes/:attributeId', (req, res, next) => {
        const {attributeId} = req.params;
        const attribute = becca.getAttribute(attributeId);

        if (!attribute) {
            return sendAttributeNotFoundError(res, attributeId);
        }

        res.json(mapAttributeToPojo(attribute));
    });
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
