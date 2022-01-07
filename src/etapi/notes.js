const becca = require("../becca/becca");
const utils = require("../services/utils");
const ru = require("./route_utils");
const mappers = require("./mappers");
const noteService = require("../services/notes");
const TaskContext = require("../services/task_context");
const validators = require("./validators");

function register(router) {
    ru.route(router, 'get', '/etapi/notes/:noteId', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId);

        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'get', '/etapi/notes/:noteId/content', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId);

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    ru.route(router, 'post' ,'/etapi/create-note', (req, res, next) => {
        const params = req.body;

        ru.getAndCheckNote(params.parentNoteId);

        try {
            const resp = noteService.createNewNote(params);

            res.json({
                note: mappers.mapNoteToPojo(resp.note),
                branch: mappers.mapBranchToPojo(resp.branch)
            });
        }
        catch (e) {
            return ru.sendError(res, 400, ru.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'title': validators.isString,
        'type': validators.isString,
        'mime': validators.isString
    };

    ru.route(router, 'patch' ,'/etapi/notes/:noteId', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId)

        if (note.isProtected) {
            throw new ru.EtapiError(400, "NOTE_IS_PROTECTED", `Note '${req.params.noteId}' is protected and cannot be modified through ETAPI`);
        }

        ru.validateAndPatch(note, req.body, ALLOWED_PROPERTIES_FOR_PATCH);

        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'delete' ,'/etapi/notes/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        const note = becca.getNote(noteId);

        if (!note) {
            return res.sendStatus(204);
        }

        noteService.deleteNote(note, null, new TaskContext('no-progress-reporting'));

        res.sendStatus(204);
    });
}

module.exports = {
    register
};
