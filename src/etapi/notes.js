const becca = require("../becca/becca");
const utils = require("../services/utils");
const ru = require("./route_utils");
const mappers = require("./mappers");
const noteService = require("../services/notes");
const TaskContext = require("../services/task_context");
const validators = require("./validators");
const searchService = require("../services/search/services/search");

function register(router) {
    ru.route(router, 'get', '/etapi/notes', (req, res, next) => {
        const {search} = req.query;

        if (!search?.trim()) {
            throw new ru.EtapiError(400, 'SEARCH_QUERY_PARAM_MANDATORY', "'search' query parameter is mandatory");
        }
        const searchParams = parseSearchParams(req);

        const foundNotes = searchService.searchNotes(search, searchParams);

        console.log(foundNotes.map(note => mappers.mapNoteToPojo(note)));

        res.json(foundNotes.map(note => mappers.mapNoteToPojo(note)));
    });

    ru.route(router, 'get', '/etapi/notes/:noteId', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId);

        res.json(mappers.mapNoteToPojo(note));
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

        if (!note || note.isDeleted) {
            return res.sendStatus(204);
        }

        noteService.deleteNote(note, null, new TaskContext('no-progress-reporting'));

        res.sendStatus(204);
    });

    ru.route(router, 'get', '/etapi/notes/:noteId/content', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId);

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    ru.route(router, 'put', '/etapi/notes/:noteId/content', (req, res, next) => {
        const note = ru.getAndCheckNote(req.params.noteId);

        note.setContent(req.body);

        return res.sendStatus(204);
    });
}

function parseSearchParams(req) {
    const rawSearchParams = {
        'fastSearch': parseBoolean(req.query, 'fastSearch'),
        'includeArchivedNotes': parseBoolean(req.query, 'includeArchivedNotes'),
        'ancestorNoteId': req.query['ancestorNoteId'],
        'ancestorDepth': parseInteger(req.query, 'ancestorDepth'),
        'orderBy': req.query['orderBy'],
        'orderDirection': parseOrderDirection(req.query, 'orderDirection'),
        'limit': parseInteger(req.query, 'limit'),
        'debug': parseBoolean(req.query, 'debug')
    };

    const searchParams = {};

    for (const paramName of Object.keys(rawSearchParams)) {
        if (rawSearchParams[paramName] !== undefined) {
            searchParams[paramName] = rawSearchParams[paramName];
        }
    }

    return searchParams;
}

const SEARCH_PARAM_ERROR = "SEARCH_PARAM_VALIDATION_ERROR";

function parseBoolean(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    if (!['true', 'false'].includes(obj[name])) {
        throw new ru.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse boolean '${name}' value '${obj[name]}, allowed values are 'true' and 'false'`);
    }

    return obj[name] === 'true';
}

function parseInteger(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    const integer = parseInt(obj[name]);

    if (!['asc', 'desc'].includes(obj[name])) {
        throw new ru.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse order direction value '${obj[name]}, allowed values are 'asc' and 'desc'`);
    }

    return integer;
}

function parseOrderDirection(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    const integer = parseInt(obj[name]);

    if (Number.isNaN(integer)) {
        throw new ru.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse integer '${name}' value '${obj[name]}`);
    }

    return integer;
}

module.exports = {
    register
};
