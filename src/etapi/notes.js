const becca = require("../becca/becca");
const utils = require("../services/utils");
const eu = require("./etapi_utils");
const mappers = require("./mappers");
const noteService = require("../services/notes");
const TaskContext = require("../services/task_context");
const validators = require("./validators");
const searchService = require("../services/search/services/search");
const SearchContext = require("../services/search/search_context");

function register(router) {
    eu.route(router, 'get', '/etapi/notes', (req, res, next) => {
        const {search} = req.query;

        if (!search?.trim()) {
            throw new eu.EtapiError(400, 'SEARCH_QUERY_PARAM_MANDATORY', "'search' query parameter is mandatory");
        }
        
        const searchParams = parseSearchParams(req);
        const searchContext = new SearchContext(searchParams);
        
        const searchResults = searchService.findResultsWithQuery(search, searchContext);
        const foundNotes = searchResults.map(sr => becca.notes[sr.noteId]);
        
        const resp = {
            results: foundNotes.map(note => mappers.mapNoteToPojo(note))
        };
        
        if (searchContext.debugInfo) {
            resp.debugInfo = searchContext.debugInfo;
        }
        
        res.json(resp);
    });

    eu.route(router, 'get', '/etapi/notes/:noteId', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId);

        res.json(mappers.mapNoteToPojo(note));
    });

    eu.route(router, 'post' ,'/etapi/create-note', (req, res, next) => {
        const params = req.body;

        eu.getAndCheckNote(params.parentNoteId);

        try {
            const resp = noteService.createNewNote(params);

            res.json({
                note: mappers.mapNoteToPojo(resp.note),
                branch: mappers.mapBranchToPojo(resp.branch)
            });
        }
        catch (e) {
            return eu.sendError(res, 400, eu.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'title': validators.isString,
        'type': validators.isString,
        'mime': validators.isString
    };

    eu.route(router, 'patch' ,'/etapi/notes/:noteId', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId)

        if (note.isProtected) {
            throw new eu.EtapiError(400, "NOTE_IS_PROTECTED", `Note '${req.params.noteId}' is protected and cannot be modified through ETAPI`);
        }

        eu.validateAndPatch(note, req.body, ALLOWED_PROPERTIES_FOR_PATCH);

        res.json(mappers.mapNoteToPojo(note));
    });

    eu.route(router, 'delete' ,'/etapi/notes/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        const note = becca.getNote(noteId);

        if (!note || note.isDeleted) {
            return res.sendStatus(204);
        }

        noteService.deleteNote(note, null, new TaskContext('no-progress-reporting'));

        res.sendStatus(204);
    });

    eu.route(router, 'get', '/etapi/notes/:noteId/content', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId);

        const filename = utils.formatDownloadTitle(note.title, note.type, note.mime);

        res.setHeader('Content-Disposition', utils.getContentDisposition(filename));

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader('Content-Type', note.mime);

        res.send(note.getContent());
    });

    eu.route(router, 'put', '/etapi/notes/:noteId/content', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId);

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
        throw new eu.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse boolean '${name}' value '${obj[name]}, allowed values are 'true' and 'false'`);
    }

    return obj[name] === 'true';
}

function parseInteger(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    const integer = parseInt(obj[name]);

    if (!['asc', 'desc'].includes(obj[name])) {
        throw new eu.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse order direction value '${obj[name]}, allowed values are 'asc' and 'desc'`);
    }

    return integer;
}

function parseOrderDirection(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    const integer = parseInt(obj[name]);

    if (Number.isNaN(integer)) {
        throw new eu.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse integer '${name}' value '${obj[name]}`);
    }

    return integer;
}

module.exports = {
    register
};
