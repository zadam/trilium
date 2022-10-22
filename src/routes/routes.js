"use strict";

const setupRoute = require('./setup');
const loginRoute = require('./login');
const indexRoute = require('./index');
const utils = require('../services/utils');
const multer = require('multer');

// API routes
const treeApiRoute = require('./api/tree');
const notesApiRoute = require('./api/notes');
const branchesApiRoute = require('./api/branches');
const autocompleteApiRoute = require('./api/autocomplete');
const cloningApiRoute = require('./api/cloning');
const noteRevisionsApiRoute = require('./api/note_revisions');
const recentChangesApiRoute = require('./api/recent_changes');
const optionsApiRoute = require('./api/options');
const passwordApiRoute = require('./api/password');
const syncApiRoute = require('./api/sync');
const loginApiRoute = require('./api/login');
const recentNotesRoute = require('./api/recent_notes');
const appInfoRoute = require('./api/app_info');
const exportRoute = require('./api/export');
const importRoute = require('./api/import');
const setupApiRoute = require('./api/setup');
const sqlRoute = require('./api/sql');
const databaseRoute = require('./api/database');
const imageRoute = require('./api/image');
const attributesRoute = require('./api/attributes');
const scriptRoute = require('./api/script');
const senderRoute = require('./api/sender');
const filesRoute = require('./api/files');
const searchRoute = require('./api/search');
const bulkActionRoute = require('./api/bulk_action');
const specialNotesRoute = require('./api/special_notes');
const noteMapRoute = require('./api/note_map');
const clipperRoute = require('./api/clipper');
const similarNotesRoute = require('./api/similar_notes');
const keysRoute = require('./api/keys');
const backendLogRoute = require('./api/backend_log');
const statsRoute = require('./api/stats');
const fontsRoute = require('./api/fonts');
const etapiTokensApiRoutes = require('./api/etapi_tokens');
const shareRoutes = require('../share/routes');
const etapiAuthRoutes = require('../etapi/auth');
const etapiAppInfoRoutes = require('../etapi/app_info');
const etapiAttributeRoutes = require('../etapi/attributes');
const etapiBranchRoutes = require('../etapi/branches');
const etapiNoteRoutes = require('../etapi/notes');
const etapiSpecialNoteRoutes = require('../etapi/special_notes');
const etapiSpecRoute = require('../etapi/spec');

const log = require('../services/log');
const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const cls = require('../services/cls');
const sql = require('../services/sql');
const entityChangesService = require('../services/entity_changes');
const csurf = require('csurf');
const {createPartialContentHandler} = require("express-partial-content");
const rateLimit = require("express-rate-limit");
const AbstractEntity = require("../becca/entities/abstract_entity");

const csrfMiddleware = csurf({
    cookie: true,
    path: '' // nothing so cookie is valid only for current path
});

/** Handling common patterns. If entity is not caught, serialization to JSON will fail */
function convertEntitiesToPojo(result) {
    if (result instanceof AbstractEntity) {
        result = result.getPojo();
    }
    else if (Array.isArray(result)) {
        for (const idx in result) {
            if (result[idx] instanceof AbstractEntity) {
                result[idx] = result[idx].getPojo();
            }
        }
    }
    else {
        if (result && result.note instanceof AbstractEntity) {
            result.note = result.note.getPojo();
        }

        if (result && result.branch instanceof AbstractEntity) {
            result.branch = result.branch.getPojo();
        }
    }

    if (result && result.executionResult) { // from runOnBackend()
        result.executionResult = convertEntitiesToPojo(result.executionResult);
    }

    return result;
}

function apiResultHandler(req, res, result) {
    res.setHeader('trilium-max-entity-change-id', entityChangesService.getMaxEntityChangeId());

    result = convertEntitiesToPojo(result);

    // if it's an array and first element is integer then we consider this to be [statusCode, response] format
    if (Array.isArray(result) && result.length > 0 && Number.isInteger(result[0])) {
        const [statusCode, response] = result;

        if (statusCode !== 200 && statusCode !== 201 && statusCode !== 204) {
            log.info(`${req.method} ${req.originalUrl} returned ${statusCode} with response ${JSON.stringify(response)}`);
        }

        return send(res, statusCode, response);
    }
    else if (result === undefined) {
        return send(res, 204, "");
    }
    else {
        return send(res, 200, result);
    }
}

function send(res, statusCode, response) {
    if (typeof response === 'string') {
        if (statusCode >= 400) {
            res.setHeader("Content-Type", "text/plain");
        }

        res.status(statusCode).send(response);

        return response.length;
    }
    else {
        const json = JSON.stringify(response);

        res.setHeader("Content-Type", "application/json");
        res.status(statusCode).send(json);

        return json.length;
    }
}

function apiRoute(method, path, routeHandler) {
    route(method, path, [auth.checkApiAuth, csrfMiddleware], routeHandler, apiResultHandler);
}

function route(method, path, middleware, routeHandler, resultHandler, transactional = true) {
    router[method](path, ...middleware, (req, res, next) => {
        const start = Date.now();

        try {
            cls.namespace.bindEmitter(req);
            cls.namespace.bindEmitter(res);

            const result = cls.init(() => {
                cls.set('componentId', req.headers['trilium-component-id']);
                cls.set('localNowDateTime', req.headers['trilium-local-now-datetime']);
                cls.set('hoistedNoteId', req.headers['trilium-hoisted-note-id'] || 'root');

                const cb = () => routeHandler(req, res, next);

                return transactional ? sql.transactional(cb) : cb();
            });

            if (resultHandler) {
                if (result && result.then) {
                    result
                        .then(actualResult => {
                            const responseLength = resultHandler(req, res, actualResult);

                            log.request(req, res, Date.now() - start, responseLength);
                        })
                        .catch(e => {
                            log.error(`${method} ${path} threw exception: ` + e.stack);

                            res.setHeader("Content-Type", "text/plain")
                                .status(500)
                                .send(e.message);
                        });
                }
                else {
                    const responseLength = resultHandler(req, res, result);

                    log.request(req, res, Date.now() - start, responseLength);
                }
            }
        }
        catch (e) {
            log.error(`${method} ${path} threw exception: ` + e.stack);

            res.setHeader("Content-Type", "text/plain")
                .status(500)
                .send(e.message);
        }
    });
}

const MAX_ALLOWED_FILE_SIZE_MB = 250;

const GET = 'get', POST = 'post', PUT = 'put', PATCH = 'patch', DELETE = 'delete';
const uploadMiddleware = multer({
    fileFilter: (req, file, cb) => {
        // UTF-8 file names are not well decoded by multer/busboy, so we handle the conversion on our side.
        // See https://github.com/expressjs/multer/pull/1102.
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf-8");
        cb(null, true);
    },
    limits: {
        fileSize: MAX_ALLOWED_FILE_SIZE_MB * 1024 * 1024
    }
}).single('upload');

const uploadMiddlewareWithErrorHandling = function (req, res, next) {
    uploadMiddleware(req, res, function (err) {
        if (err?.code === 'LIMIT_FILE_SIZE') {
            res.setHeader("Content-Type", "text/plain")
                .status(400)
                .send(`Cannot upload file because it excceeded max allowed file size of ${MAX_ALLOWED_FILE_SIZE_MB} MiB`);
        }
        else {
            next();
        }
    });
};

function register(app) {
    route(GET, '/', [auth.checkAuth, csrfMiddleware], indexRoute.index);
    route(GET, '/login', [auth.checkAppInitialized, auth.checkPasswordSet], loginRoute.loginPage);
    route(GET, '/set-password', [auth.checkAppInitialized, auth.checkPasswordNotSet], loginRoute.setPasswordPage);

    const loginRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10 // limit each IP to 10 requests per windowMs
    });

    route(POST, '/login', [loginRateLimiter], loginRoute.login);
    route(POST, '/logout', [csrfMiddleware, auth.checkAuth], loginRoute.logout);
    route(POST, '/set-password', [auth.checkAppInitialized, auth.checkPasswordNotSet], loginRoute.setPassword);
    route(GET, '/setup', [], setupRoute.setupPage);

    apiRoute(GET, '/api/tree', treeApiRoute.getTree);
    apiRoute(POST, '/api/tree/load', treeApiRoute.load);
    apiRoute(PUT, '/api/branches/:branchId/set-prefix', branchesApiRoute.setPrefix);

    apiRoute(PUT, '/api/branches/:branchId/move-to/:parentBranchId', branchesApiRoute.moveBranchToParent);
    apiRoute(PUT, '/api/branches/:branchId/move-before/:beforeBranchId', branchesApiRoute.moveBranchBeforeNote);
    apiRoute(PUT, '/api/branches/:branchId/move-after/:afterBranchId', branchesApiRoute.moveBranchAfterNote);
    apiRoute(PUT, '/api/branches/:branchId/expanded/:expanded', branchesApiRoute.setExpanded);
    apiRoute(PUT, '/api/branches/:branchId/expanded-subtree/:expanded', branchesApiRoute.setExpandedForSubtree);
    apiRoute(DELETE, '/api/branches/:branchId', branchesApiRoute.deleteBranch);

    apiRoute(GET, '/api/autocomplete', autocompleteApiRoute.getAutocomplete);

    apiRoute(GET, '/api/notes/:noteId', notesApiRoute.getNote);
    apiRoute(PUT, '/api/notes/:noteId/content', notesApiRoute.updateNoteContent);
    apiRoute(DELETE, '/api/notes/:noteId', notesApiRoute.deleteNote);
    apiRoute(PUT, '/api/notes/:noteId/undelete', notesApiRoute.undeleteNote);
    apiRoute(POST, '/api/notes/:parentNoteId/children', notesApiRoute.createNote);
    apiRoute(PUT, '/api/notes/:noteId/sort-children', notesApiRoute.sortChildNotes);
    apiRoute(PUT, '/api/notes/:noteId/protect/:isProtected', notesApiRoute.protectNote);
    apiRoute(PUT, '/api/notes/:noteId/type', notesApiRoute.setNoteTypeMime);
    apiRoute(GET, '/api/notes/:noteId/revisions', noteRevisionsApiRoute.getNoteRevisions);
    apiRoute(DELETE, '/api/notes/:noteId/revisions', noteRevisionsApiRoute.eraseAllNoteRevisions);
    apiRoute(GET, '/api/notes/:noteId/revisions/:noteRevisionId', noteRevisionsApiRoute.getNoteRevision);
    apiRoute(DELETE, '/api/notes/:noteId/revisions/:noteRevisionId', noteRevisionsApiRoute.eraseNoteRevision);
    route(GET, '/api/notes/:noteId/revisions/:noteRevisionId/download', [auth.checkApiAuthOrElectron], noteRevisionsApiRoute.downloadNoteRevision);
    apiRoute(PUT, '/api/notes/:noteId/restore-revision/:noteRevisionId', noteRevisionsApiRoute.restoreNoteRevision);
    apiRoute(POST, '/api/notes/relation-map', notesApiRoute.getRelationMap);
    apiRoute(POST, '/api/notes/erase-deleted-notes-now', notesApiRoute.eraseDeletedNotesNow);
    apiRoute(PUT, '/api/notes/:noteId/title', notesApiRoute.changeTitle);
    apiRoute(POST, '/api/notes/:noteId/duplicate/:parentNoteId', notesApiRoute.duplicateSubtree);
    apiRoute(POST, '/api/notes/:noteId/upload-modified-file', notesApiRoute.uploadModifiedFile);

    apiRoute(GET, '/api/edited-notes/:date', noteRevisionsApiRoute.getEditedNotesOnDate);

    apiRoute(PUT, '/api/notes/:noteId/clone-to-branch/:parentBranchId', cloningApiRoute.cloneNoteToBranch);
    apiRoute(PUT, '/api/notes/:noteId/clone-to-note/:parentNoteId', cloningApiRoute.cloneNoteToNote);
    apiRoute(PUT, '/api/notes/:noteId/clone-after/:afterBranchId', cloningApiRoute.cloneNoteAfter);

    route(GET, '/api/notes/:branchId/export/:type/:format/:version/:taskId', [auth.checkApiAuthOrElectron], exportRoute.exportBranch);
    route(POST, '/api/notes/:parentNoteId/import', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], importRoute.importToBranch, apiResultHandler);

    route(PUT, '/api/notes/:noteId/file', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware],
        filesRoute.updateFile, apiResultHandler);

    route(GET, '/api/notes/:noteId/open', [auth.checkApiAuthOrElectron], filesRoute.openFile);
    route(GET, '/api/notes/:noteId/open-partial', [auth.checkApiAuthOrElectron],
        createPartialContentHandler(filesRoute.fileContentProvider, {
            debug: (string, extra) => { console.log(string, extra); }
        }));
    route(GET, '/api/notes/:noteId/download', [auth.checkApiAuthOrElectron], filesRoute.downloadFile);
    // this "hacky" path is used for easier referencing of CSS resources
    route(GET, '/api/notes/download/:noteId', [auth.checkApiAuthOrElectron], filesRoute.downloadFile);
    apiRoute(POST, '/api/notes/:noteId/save-to-tmp-dir', filesRoute.saveToTmpDir);

    apiRoute(GET, '/api/notes/:noteId/attributes', attributesRoute.getEffectiveNoteAttributes);
    apiRoute(POST, '/api/notes/:noteId/attributes', attributesRoute.addNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/attributes', attributesRoute.updateNoteAttributes);
    apiRoute(PUT, '/api/notes/:noteId/attribute', attributesRoute.updateNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/set-attribute', attributesRoute.setNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.createRelation);
    apiRoute(DELETE, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.deleteRelation);
    apiRoute(DELETE, '/api/notes/:noteId/attributes/:attributeId', attributesRoute.deleteNoteAttribute);
    apiRoute(GET, '/api/attributes/names', attributesRoute.getAttributeNames);
    apiRoute(GET, '/api/attributes/values/:attributeName', attributesRoute.getValuesForAttribute);

    apiRoute(POST, '/api/note-map/:noteId/tree', noteMapRoute.getTreeMap);
    apiRoute(POST, '/api/note-map/:noteId/link', noteMapRoute.getLinkMap);
    apiRoute(GET, '/api/note-map/:noteId/backlink-count', noteMapRoute.getBacklinkCount);
    apiRoute(GET, '/api/note-map/:noteId/backlinks', noteMapRoute.getBacklinks);

    apiRoute(GET, '/api/special-notes/inbox/:date', specialNotesRoute.getInboxNote);
    apiRoute(GET, '/api/special-notes/days/:date', specialNotesRoute.getDayNote);
    apiRoute(GET, '/api/special-notes/weeks/:date', specialNotesRoute.getWeekNote);
    apiRoute(GET, '/api/special-notes/months/:month', specialNotesRoute.getMonthNote);
    apiRoute(GET, '/api/special-notes/years/:year', specialNotesRoute.getYearNote);
    apiRoute(GET, '/api/special-notes/notes-for-month/:month', specialNotesRoute.getDayNotesForMonth);
    apiRoute(POST, '/api/special-notes/sql-console', specialNotesRoute.createSqlConsole);
    apiRoute(POST, '/api/special-notes/save-sql-console', specialNotesRoute.saveSqlConsole);
    apiRoute(POST, '/api/special-notes/search-note', specialNotesRoute.createSearchNote);
    apiRoute(POST, '/api/special-notes/save-search-note', specialNotesRoute.saveSearchNote);

    // :filename is not used by trilium, but instead used for "save as" to assign a human-readable filename
    route(GET, '/api/images/:noteId/:filename', [auth.checkApiAuthOrElectron], imageRoute.returnImage);
    route(POST, '/api/images', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], imageRoute.uploadImage, apiResultHandler);
    route(PUT, '/api/images/:noteId', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], imageRoute.updateImage, apiResultHandler);

    apiRoute(GET, '/api/recent-changes/:ancestorNoteId', recentChangesApiRoute.getRecentChanges);

    apiRoute(GET, '/api/options', optionsApiRoute.getOptions);
    // FIXME: possibly change to sending value in the body to avoid host of HTTP server issues with slashes
    apiRoute(PUT, '/api/options/:name/:value*', optionsApiRoute.updateOption);
    apiRoute(PUT, '/api/options', optionsApiRoute.updateOptions);
    apiRoute(GET, '/api/options/user-themes', optionsApiRoute.getUserThemes);

    apiRoute(POST, '/api/password/change', passwordApiRoute.changePassword);
    apiRoute(POST, '/api/password/reset', passwordApiRoute.resetPassword);

    apiRoute(POST, '/api/sync/test', syncApiRoute.testSync);
    apiRoute(POST, '/api/sync/now', syncApiRoute.syncNow);
    apiRoute(POST, '/api/sync/fill-entity-changes', syncApiRoute.fillEntityChanges);
    apiRoute(POST, '/api/sync/force-full-sync', syncApiRoute.forceFullSync);
    apiRoute(POST, '/api/sync/force-note-sync/:noteId', syncApiRoute.forceNoteSync);
    route(GET, '/api/sync/check', [auth.checkApiAuth], syncApiRoute.checkSync, apiResultHandler);
    route(GET, '/api/sync/changed', [auth.checkApiAuth], syncApiRoute.getChanged, apiResultHandler);
    route(PUT, '/api/sync/update', [auth.checkApiAuth], syncApiRoute.update, apiResultHandler);
    route(POST, '/api/sync/finished', [auth.checkApiAuth], syncApiRoute.syncFinished, apiResultHandler);
    route(POST, '/api/sync/check-entity-changes', [auth.checkApiAuth], syncApiRoute.checkEntityChanges, apiResultHandler);
    route(POST, '/api/sync/queue-sector/:entityName/:sector', [auth.checkApiAuth], syncApiRoute.queueSector, apiResultHandler);
    route(GET, '/api/sync/stats', [], syncApiRoute.getStats, apiResultHandler);

    apiRoute(POST, '/api/recent-notes', recentNotesRoute.addRecentNote);
    apiRoute(GET, '/api/app-info', appInfoRoute.getAppInfo);

    // docker health check
    route(GET, '/api/health-check', [], () => ({"status": "ok"}), apiResultHandler);

    // group of services below are meant to be executed from outside
    route(GET, '/api/setup/status', [], setupApiRoute.getStatus, apiResultHandler);
    route(POST, '/api/setup/new-document', [auth.checkAppNotInitialized], setupApiRoute.setupNewDocument, apiResultHandler, false);
    route(POST, '/api/setup/sync-from-server', [auth.checkAppNotInitialized], setupApiRoute.setupSyncFromServer, apiResultHandler, false);
    route(GET, '/api/setup/sync-seed', [auth.checkCredentials], setupApiRoute.getSyncSeed, apiResultHandler);
    route(POST, '/api/setup/sync-seed', [auth.checkAppNotInitialized], setupApiRoute.saveSyncSeed, apiResultHandler, false);

    apiRoute(GET, '/api/sql/schema', sqlRoute.getSchema);
    apiRoute(POST, '/api/sql/execute/:noteId', sqlRoute.execute);
    route(POST, '/api/database/anonymize/:type', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.anonymize, apiResultHandler, false);

    // backup requires execution outside of transaction
    route(POST, '/api/database/backup-database', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.backupDatabase, apiResultHandler, false);

    // VACUUM requires execution outside of transaction
    route(POST, '/api/database/vacuum-database', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.vacuumDatabase, apiResultHandler, false);

    route(POST, '/api/database/find-and-fix-consistency-issues', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.findAndFixConsistencyIssues, apiResultHandler, false);

    apiRoute(GET, '/api/database/check-integrity', databaseRoute.checkIntegrity);

    apiRoute(POST, '/api/script/exec', scriptRoute.exec);
    apiRoute(POST, '/api/script/run/:noteId', scriptRoute.run);
    apiRoute(GET, '/api/script/startup', scriptRoute.getStartupBundles);
    apiRoute(GET, '/api/script/widgets', scriptRoute.getWidgetBundles);
    apiRoute(GET, '/api/script/bundle/:noteId', scriptRoute.getBundle);
    apiRoute(GET, '/api/script/relation/:noteId/:relationName', scriptRoute.getRelationBundles);

    // no CSRF since this is called from android app
    route(POST, '/api/sender/login', [], loginApiRoute.token, apiResultHandler);
    route(POST, '/api/sender/image', [auth.checkEtapiToken, uploadMiddlewareWithErrorHandling], senderRoute.uploadImage, apiResultHandler);
    route(POST, '/api/sender/note', [auth.checkEtapiToken], senderRoute.saveNote, apiResultHandler);

    apiRoute(GET, '/api/quick-search/:searchString', searchRoute.quickSearch);
    apiRoute(GET, '/api/search-note/:noteId', searchRoute.searchFromNote);
    apiRoute(POST, '/api/search-and-execute-note/:noteId', searchRoute.searchAndExecute);
    apiRoute(POST, '/api/search-related', searchRoute.getRelatedNotes);
    apiRoute(GET, '/api/search/:searchString', searchRoute.search);
    apiRoute(GET, '/api/search-templates', searchRoute.searchTemplates);

    apiRoute(POST, '/api/bulk-action/execute', bulkActionRoute.execute);
    apiRoute(POST, '/api/bulk-action/affected-notes', bulkActionRoute.getAffectedNoteCount);

    route(POST, '/api/login/sync', [], loginApiRoute.loginSync, apiResultHandler);
    // this is for entering protected mode so user has to be already logged-in (that's the reason we don't require username)
    apiRoute(POST, '/api/login/protected', loginApiRoute.loginToProtectedSession);
    apiRoute(POST, '/api/login/protected/touch', loginApiRoute.touchProtectedSession);
    apiRoute(POST, '/api/logout/protected', loginApiRoute.logoutFromProtectedSession);

    route(POST, '/api/login/token', [], loginApiRoute.token, apiResultHandler);

    // in case of local electron, local calls are allowed unauthenticated, for server they need auth
    const clipperMiddleware = utils.isElectron() ? [] : [auth.checkEtapiToken];

    route(GET, '/api/clipper/handshake', clipperMiddleware, clipperRoute.handshake, apiResultHandler);
    route(POST, '/api/clipper/clippings', clipperMiddleware, clipperRoute.addClipping, apiResultHandler);
    route(POST, '/api/clipper/notes', clipperMiddleware, clipperRoute.createNote, apiResultHandler);
    route(POST, '/api/clipper/open/:noteId', clipperMiddleware, clipperRoute.openNote, apiResultHandler);

    apiRoute(GET, '/api/similar-notes/:noteId', similarNotesRoute.getSimilarNotes);

    apiRoute(GET, '/api/keyboard-actions', keysRoute.getKeyboardActions);
    apiRoute(GET, '/api/keyboard-shortcuts-for-notes', keysRoute.getShortcutsForNotes);

    apiRoute(GET, '/api/backend-log', backendLogRoute.getBackendLog);

    apiRoute(GET, '/api/stats/note-size/:noteId', statsRoute.getNoteSize);
    apiRoute(GET, '/api/stats/subtree-size/:noteId', statsRoute.getSubtreeSize);

    apiRoute(POST, '/api/delete-notes-preview', notesApiRoute.getDeleteNotesPreview);

    route(GET, '/api/fonts', [auth.checkApiAuthOrElectron], fontsRoute.getFontCss);

    apiRoute(GET, '/api/etapi-tokens', etapiTokensApiRoutes.getTokens);
    apiRoute(POST, '/api/etapi-tokens', etapiTokensApiRoutes.createToken);
    apiRoute(PATCH, '/api/etapi-tokens/:etapiTokenId', etapiTokensApiRoutes.patchToken);
    apiRoute(DELETE, '/api/etapi-tokens/:etapiTokenId', etapiTokensApiRoutes.deleteToken);

    shareRoutes.register(router);

    etapiAuthRoutes.register(router, [loginRateLimiter]);
    etapiAppInfoRoutes.register(router);
    etapiAttributeRoutes.register(router);
    etapiBranchRoutes.register(router);
    etapiNoteRoutes.register(router);
    etapiSpecialNoteRoutes.register(router);
    etapiSpecRoute.register(router);

    app.use('', router);
}

module.exports = {
    register
};
