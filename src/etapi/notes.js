const becca = require("../becca/becca");
const utils = require("../services/utils");
const eu = require("./etapi_utils");
const mappers = require("./mappers");
const noteService = require("../services/notes");
const TaskContext = require("../services/task_context");
const v = require("./validators");
const searchService = require("../services/search/services/search");
const SearchContext = require("../services/search/search_context");
const zipExportService = require("../services/export/zip");
const noteRevisionService = require("../services/note_revisions.js");

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

    const ALLOWED_PROPERTIES_FOR_CREATE_NOTE = {
        'parentNoteId': [v.mandatory, v.notNull, v.isNoteId],
        'title': [v.mandatory, v.notNull, v.isString],
        'type': [v.mandatory, v.notNull, v.isNoteType],
        'mime': [v.notNull, v.isString],
        'content': [v.notNull, v.isString],
        'notePosition': [v.notNull, v.isInteger],
        'prefix': [v.notNull, v.isString],
        'isExpanded': [v.notNull, v.isBoolean],
        'noteId': [v.notNull, v.isValidEntityId],
        'branchId': [v.notNull, v.isValidEntityId],
    };

    eu.route(router, 'post' ,'/etapi/create-note', (req, res, next) => {
        const params = {};

        eu.validateAndPatch(params, req.body, ALLOWED_PROPERTIES_FOR_CREATE_NOTE);

        try {
            const resp = noteService.createNewNote(params);

            res.status(201).json({
                note: mappers.mapNoteToPojo(resp.note),
                branch: mappers.mapBranchToPojo(resp.branch)
            });
        }
        catch (e) {
            return eu.sendError(res, 500, eu.GENERIC_CODE, e.message);
        }
    });

    const ALLOWED_PROPERTIES_FOR_PATCH = {
        'title': [v.notNull, v.isString],
        'type': [v.notNull, v.isString],
        'mime': [v.notNull, v.isString]
    };

    eu.route(router, 'patch' ,'/etapi/notes/:noteId', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId)

        if (note.isProtected) {
            throw new eu.EtapiError(400, "NOTE_IS_PROTECTED", `Note '${req.params.noteId}' is protected and cannot be modified through ETAPI`);
        }

        eu.validateAndPatch(note, req.body, ALLOWED_PROPERTIES_FOR_PATCH);
        note.save();

        res.json(mappers.mapNoteToPojo(note));
    });

    eu.route(router, 'delete' ,'/etapi/notes/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        const note = becca.getNote(noteId);

        if (!note || note.isDeleted) {
            return res.sendStatus(204);
        }

        note.deleteNote(null, new TaskContext('no-progress-reporting'));

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

        noteService.scanForLinks(note);

        return res.sendStatus(204);
    });

    eu.route(router, 'get' ,'/etapi/notes/:noteId/export', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId);
        const format = req.query.format || "html";

        if (!["html", "markdown"].includes(format)) {
            throw new eu.EtapiError(400, "UNRECOGNIZED_EXPORT_FORMAT", `Unrecognized export format '${format}', supported values are 'html' (default) or 'markdown'`);
        }

        const taskContext = new TaskContext('no-progress-reporting');

        // technically a branch is being exported (includes prefix), but it's such a minor difference yet usability pain
        // (e.g. branchIds are not seen in UI), that we export "note export" instead.
        const branch = note.getParentBranches()[0];

        console.log(note.getParentBranches());

        zipExportService.exportToZip(taskContext, branch, format, res);
    });

    eu.route(router, 'post' ,'/etapi/notes/:noteId/note-revision', (req, res, next) => {
        const note = eu.getAndCheckNote(req.params.noteId);

        note.saveNoteRevision();

        return res.sendStatus(204);
    });
}

function parseSearchParams(req) {
    const rawSearchParams = {
        fastSearch: parseBoolean(req.query, 'fastSearch'),
        includeArchivedNotes: parseBoolean(req.query, 'includeArchivedNotes'),
        ancestorNoteId: req.query['ancestorNoteId'],
        ancestorDepth: req.query['ancestorDepth'], // e.g. "eq5"
        orderBy: req.query['orderBy'],
        orderDirection: parseOrderDirection(req.query, 'orderDirection'),
        limit: parseInteger(req.query, 'limit'),
        debug: parseBoolean(req.query, 'debug')
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

function parseOrderDirection(obj, name) {
    if (!(name in obj)) {
        return undefined;
    }

    const integer = parseInt(obj[name]);

    if (!['asc', 'desc'].includes(obj[name])) {
        throw new eu.EtapiError(400, SEARCH_PARAM_ERROR, `Cannot parse order direction value '${obj[name]}, allowed values are 'asc' and 'desc'`);
    }

    return integer;
}

function parseInteger(obj, name) {
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
