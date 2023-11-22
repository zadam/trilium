"use strict";

const utils = require('../services/utils.js');
const multer = require('multer');
const log = require('../services/log.js');
const express = require('express');
const router = express.Router();
const auth = require('../services/auth.js');
const cls = require('../services/cls.js');
const sql = require('../services/sql.js');
const entityChangesService = require('../services/entity_changes.js');
const csurf = require('csurf');
const { createPartialContentHandler } = require("express-partial-content");
const rateLimit = require("express-rate-limit");
const AbstractBeccaEntity = require('../becca/entities/abstract_becca_entity.js');
const NotFoundError = require('../errors/not_found_error.js');
const ValidationError = require('../errors/validation_error.js');

// page routes
const setupRoute = require('./setup.js');
const loginRoute = require('./login.js');
const indexRoute = require('./index.js');

// API routes
const treeApiRoute = require('./api/tree.js');
const notesApiRoute = require('./api/notes.js');
const branchesApiRoute = require('./api/branches.js');
const attachmentsApiRoute = require('./api/attachments.js');
const autocompleteApiRoute = require('./api/autocomplete.js');
const cloningApiRoute = require('./api/cloning.js');
const revisionsApiRoute = require('./api/revisions.js');
const recentChangesApiRoute = require('./api/recent_changes.js');
const optionsApiRoute = require('./api/options.js');
const passwordApiRoute = require('./api/password.js');
const syncApiRoute = require('./api/sync.js');
const loginApiRoute = require('./api/login.js');
const recentNotesRoute = require('./api/recent_notes.js');
const appInfoRoute = require('./api/app_info.js');
const exportRoute = require('./api/export.js');
const importRoute = require('./api/import.js');
const setupApiRoute = require('./api/setup.js');
const sqlRoute = require('./api/sql.js');
const databaseRoute = require('./api/database.js');
const imageRoute = require('./api/image.js');
const attributesRoute = require('./api/attributes.js');
const scriptRoute = require('./api/script.js');
const senderRoute = require('./api/sender.js');
const filesRoute = require('./api/files.js');
const searchRoute = require('./api/search.js');
const bulkActionRoute = require('./api/bulk_action.js');
const specialNotesRoute = require('./api/special_notes.js');
const noteMapRoute = require('./api/note_map.js');
const clipperRoute = require('./api/clipper.js');
const similarNotesRoute = require('./api/similar_notes.js');
const keysRoute = require('./api/keys.js');
const backendLogRoute = require('./api/backend_log.js');
const statsRoute = require('./api/stats.js');
const fontsRoute = require('./api/fonts.js');
const etapiTokensApiRoutes = require('./api/etapi_tokens.js');
const relationMapApiRoute = require('./api/relation-map');
const otherRoute = require('./api/other.js');
const shareRoutes = require('../share/routes.js');

const etapiAuthRoutes = require('../etapi/auth.js');
const etapiAppInfoRoutes = require('../etapi/app_info.js');
const etapiAttachmentRoutes = require('../etapi/attachments.js');
const etapiAttributeRoutes = require('../etapi/attributes.js');
const etapiBranchRoutes = require('../etapi/branches.js');
const etapiNoteRoutes = require('../etapi/notes.js');
const etapiSpecialNoteRoutes = require('../etapi/special_notes.js');
const etapiSpecRoute = require('../etapi/spec.js');
const etapiBackupRoute = require('../etapi/backup.js');

const csrfMiddleware = csurf({
    cookie: true,
    path: '' // empty, so cookie is valid only for the current path
});

const MAX_ALLOWED_FILE_SIZE_MB = 250;
const GET = 'get', PST = 'post', PUT = 'put', PATCH = 'patch', DEL = 'delete';

const uploadMiddleware = createUploadMiddleware();

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
        max: 10, // limit each IP to 10 requests per windowMs
        skipSuccessfulRequests: true // successful auth to rate-limited ETAPI routes isn't counted. However, successful auth to /login is still counted!
    });

    route(PST, '/login', [loginRateLimiter], loginRoute.login);
    route(PST, '/logout', [csrfMiddleware, auth.checkAuth], loginRoute.logout);
    route(PST, '/set-password', [auth.checkAppInitialized, auth.checkPasswordNotSet], loginRoute.setPassword);
    route(GET, '/setup', [], setupRoute.setupPage);

    apiRoute(GET, '/api/tree', treeApiRoute.getTree);
    apiRoute(PST, '/api/tree/load', treeApiRoute.load);

    apiRoute(GET, '/api/notes/:noteId', notesApiRoute.getNote);
    apiRoute(GET, '/api/notes/:noteId/blob', notesApiRoute.getNoteBlob);
    apiRoute(GET, '/api/notes/:noteId/metadata', notesApiRoute.getNoteMetadata);
    apiRoute(PUT, '/api/notes/:noteId/data', notesApiRoute.updateNoteData);
    apiRoute(DEL, '/api/notes/:noteId', notesApiRoute.deleteNote);
    apiRoute(PUT, '/api/notes/:noteId/undelete', notesApiRoute.undeleteNote);
    apiRoute(PST, '/api/notes/:noteId/revision', notesApiRoute.forceSaveRevision);
    apiRoute(PST, '/api/notes/:parentNoteId/children', notesApiRoute.createNote);
    apiRoute(PUT, '/api/notes/:noteId/sort-children', notesApiRoute.sortChildNotes);
    apiRoute(PUT, '/api/notes/:noteId/protect/:isProtected', notesApiRoute.protectNote);
    apiRoute(PUT, '/api/notes/:noteId/type', notesApiRoute.setNoteTypeMime);
    apiRoute(PUT, '/api/notes/:noteId/title', notesApiRoute.changeTitle);
    apiRoute(PST, '/api/notes/:noteId/duplicate/:parentNoteId', notesApiRoute.duplicateSubtree);
    apiRoute(PUT, '/api/notes/:noteId/clone-to-branch/:parentBranchId', cloningApiRoute.cloneNoteToBranch);
    apiRoute(PUT, '/api/notes/:noteId/toggle-in-parent/:parentNoteId/:present', cloningApiRoute.toggleNoteInParent);
    apiRoute(PUT, '/api/notes/:noteId/clone-to-note/:parentNoteId', cloningApiRoute.cloneNoteToParentNote);
    apiRoute(PUT, '/api/notes/:noteId/clone-after/:afterBranchId', cloningApiRoute.cloneNoteAfter);
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
    apiRoute(PST, '/api/notes/:noteId/save-to-tmp-dir', filesRoute.saveNoteToTmpDir);
    apiRoute(PST, '/api/notes/:noteId/upload-modified-file', filesRoute.uploadModifiedFileToNote);
    apiRoute(PST, '/api/notes/:noteId/convert-to-attachment', notesApiRoute.convertNoteToAttachment);

    apiRoute(PUT, '/api/branches/:branchId/move-to/:parentBranchId', branchesApiRoute.moveBranchToParent);
    apiRoute(PUT, '/api/branches/:branchId/move-before/:beforeBranchId', branchesApiRoute.moveBranchBeforeNote);
    apiRoute(PUT, '/api/branches/:branchId/move-after/:afterBranchId', branchesApiRoute.moveBranchAfterNote);
    apiRoute(PUT, '/api/branches/:branchId/expanded/:expanded', branchesApiRoute.setExpanded);
    apiRoute(PUT, '/api/branches/:branchId/expanded-subtree/:expanded', branchesApiRoute.setExpandedForSubtree);
    apiRoute(DEL, '/api/branches/:branchId', branchesApiRoute.deleteBranch);
    apiRoute(PUT, '/api/branches/:branchId/set-prefix', branchesApiRoute.setPrefix);

    apiRoute(GET, '/api/notes/:noteId/attachments', attachmentsApiRoute.getAttachments);
    apiRoute(PST, '/api/notes/:noteId/attachments', attachmentsApiRoute.saveAttachment);
    route(PST, '/api/notes/:noteId/attachments/upload', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], attachmentsApiRoute.uploadAttachment, apiResultHandler);
    apiRoute(GET, '/api/attachments/:attachmentId', attachmentsApiRoute.getAttachment);
    apiRoute(GET, '/api/attachments/:attachmentId/all', attachmentsApiRoute.getAllAttachments);
    apiRoute(PST, '/api/attachments/:attachmentId/convert-to-note', attachmentsApiRoute.convertAttachmentToNote);
    apiRoute(DEL, '/api/attachments/:attachmentId', attachmentsApiRoute.deleteAttachment);
    apiRoute(PUT, '/api/attachments/:attachmentId/rename', attachmentsApiRoute.renameAttachment);
    apiRoute(GET, '/api/attachments/:attachmentId/blob', attachmentsApiRoute.getAttachmentBlob);
    route(GET, '/api/attachments/:attachmentId/image/:filename', [auth.checkApiAuthOrElectron], imageRoute.returnAttachedImage);
    route(GET, '/api/attachments/:attachmentId/open', [auth.checkApiAuthOrElectron], filesRoute.openAttachment);
    route(GET, '/api/attachments/:attachmentId/open-partial', [auth.checkApiAuthOrElectron],
        createPartialContentHandler(filesRoute.attachmentContentProvider, {
            debug: (string, extra) => { console.log(string, extra); }
        }));
    route(GET, '/api/attachments/:attachmentId/download', [auth.checkApiAuthOrElectron], filesRoute.downloadAttachment);
    // this "hacky" path is used for easier referencing of CSS resources
    route(GET, '/api/attachments/download/:attachmentId', [auth.checkApiAuthOrElectron], filesRoute.downloadAttachment);
    apiRoute(PST, '/api/attachments/:attachmentId/save-to-tmp-dir', filesRoute.saveAttachmentToTmpDir);
    apiRoute(PST, '/api/attachments/:attachmentId/upload-modified-file', filesRoute.uploadModifiedFileToAttachment);
    route(PUT, '/api/attachments/:attachmentId/file', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware],
        filesRoute.updateAttachment, apiResultHandler);

    apiRoute(GET, '/api/notes/:noteId/revisions', revisionsApiRoute.getRevisions);
    apiRoute(DEL, '/api/notes/:noteId/revisions', revisionsApiRoute.eraseAllRevisions);
    apiRoute(GET, '/api/revisions/:revisionId', revisionsApiRoute.getRevision);
    apiRoute(GET, '/api/revisions/:revisionId/blob', revisionsApiRoute.getRevisionBlob);
    apiRoute(DEL, '/api/revisions/:revisionId', revisionsApiRoute.eraseRevision);
    apiRoute(PST, '/api/revisions/:revisionId/restore', revisionsApiRoute.restoreRevision);
    route(GET, '/api/revisions/:revisionId/image/:filename', [auth.checkApiAuthOrElectron], imageRoute.returnImageFromRevision);

    route(GET, '/api/revisions/:revisionId/download', [auth.checkApiAuthOrElectron], revisionsApiRoute.downloadRevision);


    route(GET, '/api/branches/:branchId/export/:type/:format/:version/:taskId', [auth.checkApiAuthOrElectron], exportRoute.exportBranch);
    route(PST, '/api/notes/:parentNoteId/notes-import', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], importRoute.importNotesToBranch, apiResultHandler);
    route(PST, '/api/notes/:parentNoteId/attachments-import', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], importRoute.importAttachmentsToNote, apiResultHandler);

    apiRoute(GET, '/api/notes/:noteId/attributes', attributesRoute.getEffectiveNoteAttributes);
    apiRoute(PST, '/api/notes/:noteId/attributes', attributesRoute.addNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/attributes', attributesRoute.updateNoteAttributes);
    apiRoute(PUT, '/api/notes/:noteId/attribute', attributesRoute.updateNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/set-attribute', attributesRoute.setNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.createRelation);
    apiRoute(DEL, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.deleteRelation);
    apiRoute(DEL, '/api/notes/:noteId/attributes/:attributeId', attributesRoute.deleteNoteAttribute);
    apiRoute(GET, '/api/attribute-names', attributesRoute.getAttributeNames);
    apiRoute(GET, '/api/attribute-values/:attributeName', attributesRoute.getValuesForAttribute);

    // :filename is not used by trilium, but instead used for "save as" to assign a human-readable filename
    route(GET, '/api/images/:noteId/:filename', [auth.checkApiAuthOrElectron], imageRoute.returnImageFromNote);
    route(PUT, '/api/images/:noteId', [auth.checkApiAuthOrElectron, uploadMiddlewareWithErrorHandling, csrfMiddleware], imageRoute.updateImage, apiResultHandler);

    apiRoute(GET, '/api/options', optionsApiRoute.getOptions);
    // FIXME: possibly change to sending value in the body to avoid host of HTTP server issues with slashes
    apiRoute(PUT, '/api/options/:name/:value*', optionsApiRoute.updateOption);
    apiRoute(PUT, '/api/options', optionsApiRoute.updateOptions);
    apiRoute(GET, '/api/options/user-themes', optionsApiRoute.getUserThemes);

    apiRoute(PST, '/api/password/change', passwordApiRoute.changePassword);
    apiRoute(PST, '/api/password/reset', passwordApiRoute.resetPassword);

    apiRoute(PST, '/api/sync/test', syncApiRoute.testSync);
    apiRoute(PST, '/api/sync/now', syncApiRoute.syncNow);
    apiRoute(PST, '/api/sync/fill-entity-changes', syncApiRoute.fillEntityChanges);
    apiRoute(PST, '/api/sync/force-full-sync', syncApiRoute.forceFullSync);
    route(GET, '/api/sync/check', [auth.checkApiAuth], syncApiRoute.checkSync, apiResultHandler);
    route(GET, '/api/sync/changed', [auth.checkApiAuth], syncApiRoute.getChanged, apiResultHandler);
    route(PUT, '/api/sync/update', [auth.checkApiAuth], syncApiRoute.update, apiResultHandler);
    route(PST, '/api/sync/finished', [auth.checkApiAuth], syncApiRoute.syncFinished, apiResultHandler);
    route(PST, '/api/sync/check-entity-changes', [auth.checkApiAuth], syncApiRoute.checkEntityChanges, apiResultHandler);
    route(PST, '/api/sync/queue-sector/:entityName/:sector', [auth.checkApiAuth], syncApiRoute.queueSector, apiResultHandler);
    route(GET, '/api/sync/stats', [], syncApiRoute.getStats, apiResultHandler);

    apiRoute(PST, '/api/recent-notes', recentNotesRoute.addRecentNote);
    apiRoute(GET, '/api/app-info', appInfoRoute.getAppInfo);

    // docker health check
    route(GET, '/api/health-check', [], () => ({"status": "ok"}), apiResultHandler);

    // group of the services below are meant to be executed from the outside
    route(GET, '/api/setup/status', [], setupApiRoute.getStatus, apiResultHandler);
    route(PST, '/api/setup/new-document', [auth.checkAppNotInitialized], setupApiRoute.setupNewDocument, apiResultHandler, false);
    route(PST, '/api/setup/sync-from-server', [auth.checkAppNotInitialized], setupApiRoute.setupSyncFromServer, apiResultHandler, false);
    route(GET, '/api/setup/sync-seed', [auth.checkCredentials], setupApiRoute.getSyncSeed, apiResultHandler);
    route(PST, '/api/setup/sync-seed', [auth.checkAppNotInitialized], setupApiRoute.saveSyncSeed, apiResultHandler, false);

    apiRoute(GET, '/api/autocomplete', autocompleteApiRoute.getAutocomplete);
    apiRoute(GET, '/api/quick-search/:searchString', searchRoute.quickSearch);
    apiRoute(GET, '/api/search-note/:noteId', searchRoute.searchFromNote);
    apiRoute(PST, '/api/search-and-execute-note/:noteId', searchRoute.searchAndExecute);
    apiRoute(PST, '/api/search-related', searchRoute.getRelatedNotes);
    apiRoute(GET, '/api/search/:searchString', searchRoute.search);
    apiRoute(GET, '/api/search-templates', searchRoute.searchTemplates);

    apiRoute(PST, '/api/bulk-action/execute', bulkActionRoute.execute);
    apiRoute(PST, '/api/bulk-action/affected-notes', bulkActionRoute.getAffectedNoteCount);

    route(PST, '/api/login/sync', [], loginApiRoute.loginSync, apiResultHandler);
    // this is for entering protected mode so user has to be already logged-in (that's the reason we don't require username)
    apiRoute(PST, '/api/login/protected', loginApiRoute.loginToProtectedSession);
    apiRoute(PST, '/api/login/protected/touch', loginApiRoute.touchProtectedSession);
    apiRoute(PST, '/api/logout/protected', loginApiRoute.logoutFromProtectedSession);

    route(PST, '/api/login/token', [loginRateLimiter], loginApiRoute.token, apiResultHandler);

    apiRoute(GET, '/api/etapi-tokens', etapiTokensApiRoutes.getTokens);
    apiRoute(PST, '/api/etapi-tokens', etapiTokensApiRoutes.createToken);
    apiRoute(PATCH, '/api/etapi-tokens/:etapiTokenId', etapiTokensApiRoutes.patchToken);
    apiRoute(DEL, '/api/etapi-tokens/:etapiTokenId', etapiTokensApiRoutes.deleteToken);

    // in case of local electron, local calls are allowed unauthenticated, for server they need auth
    const clipperMiddleware = utils.isElectron() ? [] : [auth.checkEtapiToken];

    route(GET, '/api/clipper/handshake', clipperMiddleware, clipperRoute.handshake, apiResultHandler);
    route(PST, '/api/clipper/clippings', clipperMiddleware, clipperRoute.addClipping, apiResultHandler);
    route(PST, '/api/clipper/notes', clipperMiddleware, clipperRoute.createNote, apiResultHandler);
    route(PST, '/api/clipper/open/:noteId', clipperMiddleware, clipperRoute.openNote, apiResultHandler);
    route(GET, '/api/clipper/notes-by-url/:noteUrl', clipperMiddleware, clipperRoute.findNotesByUrl, apiResultHandler);

    apiRoute(GET, '/api/special-notes/inbox/:date', specialNotesRoute.getInboxNote);
    apiRoute(GET, '/api/special-notes/days/:date', specialNotesRoute.getDayNote);
    apiRoute(GET, '/api/special-notes/weeks/:date', specialNotesRoute.getWeekNote);
    apiRoute(GET, '/api/special-notes/months/:month', specialNotesRoute.getMonthNote);
    apiRoute(GET, '/api/special-notes/years/:year', specialNotesRoute.getYearNote);
    apiRoute(GET, '/api/special-notes/notes-for-month/:month', specialNotesRoute.getDayNotesForMonth);
    apiRoute(PST, '/api/special-notes/sql-console', specialNotesRoute.createSqlConsole);
    apiRoute(PST, '/api/special-notes/save-sql-console', specialNotesRoute.saveSqlConsole);
    apiRoute(PST, '/api/special-notes/search-note', specialNotesRoute.createSearchNote);
    apiRoute(PST, '/api/special-notes/save-search-note', specialNotesRoute.saveSearchNote);
    apiRoute(PST, '/api/special-notes/launchers/:noteId/reset', specialNotesRoute.resetLauncher);
    apiRoute(PST, '/api/special-notes/launchers/:parentNoteId/:launcherType', specialNotesRoute.createLauncher);
    apiRoute(PUT, '/api/special-notes/api-script-launcher', specialNotesRoute.createOrUpdateScriptLauncherFromApi);

    apiRoute(GET, '/api/sql/schema', sqlRoute.getSchema);
    apiRoute(PST, '/api/sql/execute/:noteId', sqlRoute.execute);
    route(PST, '/api/database/anonymize/:type', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.anonymize, apiResultHandler, false);
    apiRoute(GET, '/api/database/anonymized-databases', databaseRoute.getExistingAnonymizedDatabases);

    // backup requires execution outside of transaction
    route(PST, '/api/database/backup-database', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.backupDatabase, apiResultHandler, false);
    apiRoute(GET, '/api/database/backups', databaseRoute.getExistingBackups);

    // VACUUM requires execution outside of transaction
    route(PST, '/api/database/vacuum-database', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.vacuumDatabase, apiResultHandler, false);

    route(PST, '/api/database/find-and-fix-consistency-issues', [auth.checkApiAuthOrElectron, csrfMiddleware], databaseRoute.findAndFixConsistencyIssues, apiResultHandler, false);

    apiRoute(GET, '/api/database/check-integrity', databaseRoute.checkIntegrity);

    route(PST, '/api/script/exec', [auth.checkApiAuth, csrfMiddleware], scriptRoute.exec, apiResultHandler, false);

    apiRoute(PST, '/api/script/run/:noteId', scriptRoute.run);
    apiRoute(GET, '/api/script/startup', scriptRoute.getStartupBundles);
    apiRoute(GET, '/api/script/widgets', scriptRoute.getWidgetBundles);
    apiRoute(PST, '/api/script/bundle/:noteId', scriptRoute.getBundle);
    apiRoute(GET, '/api/script/relation/:noteId/:relationName', scriptRoute.getRelationBundles);

    // no CSRF since this is called from android app
    route(PST, '/api/sender/login', [loginRateLimiter], loginApiRoute.token, apiResultHandler);
    route(PST, '/api/sender/image', [auth.checkEtapiToken, uploadMiddlewareWithErrorHandling], senderRoute.uploadImage, apiResultHandler);
    route(PST, '/api/sender/note', [auth.checkEtapiToken], senderRoute.saveNote, apiResultHandler);

    apiRoute(GET, '/api/keyboard-actions', keysRoute.getKeyboardActions);
    apiRoute(GET, '/api/keyboard-shortcuts-for-notes', keysRoute.getShortcutsForNotes);

    apiRoute(PST, '/api/relation-map', relationMapApiRoute.getRelationMap);
    apiRoute(PST, '/api/notes/erase-deleted-notes-now', notesApiRoute.eraseDeletedNotesNow);
    apiRoute(PST, '/api/notes/erase-unused-attachments-now', notesApiRoute.eraseUnusedAttachmentsNow);
    apiRoute(GET, '/api/similar-notes/:noteId', similarNotesRoute.getSimilarNotes);
    apiRoute(GET, '/api/backend-log', backendLogRoute.getBackendLog);
    apiRoute(GET, '/api/stats/note-size/:noteId', statsRoute.getNoteSize);
    apiRoute(GET, '/api/stats/subtree-size/:noteId', statsRoute.getSubtreeSize);
    apiRoute(PST, '/api/delete-notes-preview', notesApiRoute.getDeleteNotesPreview);
    route(GET, '/api/fonts', [auth.checkApiAuthOrElectron], fontsRoute.getFontCss);
    apiRoute(GET, '/api/other/icon-usage', otherRoute.getIconUsage);
    apiRoute(PST, '/api/other/render-markdown', otherRoute.renderMarkdown);
    apiRoute(GET, '/api/recent-changes/:ancestorNoteId', recentChangesApiRoute.getRecentChanges);
    apiRoute(GET, '/api/edited-notes/:date', revisionsApiRoute.getEditedNotesOnDate);

    apiRoute(PST, '/api/note-map/:noteId/tree', noteMapRoute.getTreeMap);
    apiRoute(PST, '/api/note-map/:noteId/link', noteMapRoute.getLinkMap);
    apiRoute(GET, '/api/note-map/:noteId/backlink-count', noteMapRoute.getBacklinkCount);
    apiRoute(GET, '/api/note-map/:noteId/backlinks', noteMapRoute.getBacklinks);

    shareRoutes.register(router);

    etapiAuthRoutes.register(router, [loginRateLimiter]);
    etapiAppInfoRoutes.register(router);
    etapiAttachmentRoutes.register(router);
    etapiAttributeRoutes.register(router);
    etapiBranchRoutes.register(router);
    etapiNoteRoutes.register(router);
    etapiSpecialNoteRoutes.register(router);
    etapiSpecRoute.register(router);
    etapiBackupRoute.register(router);

    app.use('', router);
}

/** Handling common patterns. If entity is not caught, serialization to JSON will fail */
function convertEntitiesToPojo(result) {
    if (result instanceof AbstractBeccaEntity) {
        result = result.getPojo();
    }
    else if (Array.isArray(result)) {
        for (const idx in result) {
            if (result[idx] instanceof AbstractBeccaEntity) {
                result[idx] = result[idx].getPojo();
            }
        }
    }
    else {
        if (result && result.note instanceof AbstractBeccaEntity) {
            result.note = result.note.getPojo();
        }

        if (result && result.branch instanceof AbstractBeccaEntity) {
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

    // if it's an array and the first element is integer, then we consider this to be [statusCode, response] format
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

function route(method, path, middleware, routeHandler, resultHandler = null, transactional = true) {
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

            if (!resultHandler) {
                return;
            }

            if (result?.then) { // promise
                result
                    .then(promiseResult => handleResponse(resultHandler, req, res, promiseResult, start))
                    .catch(e => handleException(e, method, path, res));
            } else {
                handleResponse(resultHandler, req, res, result, start)
            }
        }
        catch (e) {
            handleException(e, method, path, res);
        }
    });
}

function handleResponse(resultHandler, req, res, result, start) {
    const responseLength = resultHandler(req, res, result);

    log.request(req, res, Date.now() - start, responseLength);
}

function handleException(e, method, path, res) {
    log.error(`${method} ${path} threw exception: '${e.message}', stack: ${e.stack}`);

    if (e instanceof ValidationError) {
        res.status(400)
            .json({
                message: e.message
            });
    } else if (e instanceof NotFoundError) {
        res.status(404)
            .json({
                message: e.message
            });
    } else {
        res.status(500)
            .json({
                message: e.message
            });
    }
}

function createUploadMiddleware() {
    const multerOptions = {
        fileFilter: (req, file, cb) => {
            // UTF-8 file names are not well decoded by multer/busboy, so we handle the conversion on our side.
            // See https://github.com/expressjs/multer/pull/1102.
            file.originalname = Buffer.from(file.originalname, "latin1").toString("utf-8");
            cb(null, true);
        }
    };

    if (!process.env.TRILIUM_NO_UPLOAD_LIMIT) {
        multerOptions.limits = {
            fileSize: MAX_ALLOWED_FILE_SIZE_MB * 1024 * 1024
        };
    }

    return multer(multerOptions).single('upload');
}

module.exports = {
    register
};
