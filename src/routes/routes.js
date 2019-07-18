const setupRoute = require('./setup');
const loginRoute = require('./login');
const indexRoute = require('./index');
const utils = require('../services/utils');
const multer = require('multer')();

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
const eventLogRoute = require('./api/event_log');
const recentNotesRoute = require('./api/recent_notes');
const appInfoRoute = require('./api/app_info');
const exportRoute = require('./api/export');
const importRoute = require('./api/import');
const setupApiRoute = require('./api/setup');
const sqlRoute = require('./api/sql');
const anonymizationRoute = require('./api/anonymization');
const cleanupRoute = require('./api/cleanup');
const imageRoute = require('./api/image');
const attributesRoute = require('./api/attributes');
const scriptRoute = require('./api/script');
const senderRoute = require('./api/sender');
const filesRoute = require('./api/file_upload');
const searchRoute = require('./api/search');
const dateNotesRoute = require('./api/date_notes');
const linkMapRoute = require('./api/link_map');
const clipperRoute = require('./api/clipper');

const log = require('../services/log');
const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const cls = require('../services/cls');
const sql = require('../services/sql');
const protectedSessionService = require('../services/protected_session');
const csurf = require('csurf');

const csrfMiddleware = csurf({
    cookie: true,
    path: '' // nothing so cookie is valid only for current path
});

function apiResultHandler(req, res, result) {
    // if it's an array and first element is integer then we consider this to be [statusCode, response] format
    if (Array.isArray(result) && result.length > 0 && Number.isInteger(result[0])) {
        const [statusCode, response] = result;

        res.status(statusCode).send(response);

        if (statusCode !== 200 && statusCode !== 201 && statusCode !== 204) {
            log.info(`${req.method} ${req.originalUrl} returned ${statusCode} with response ${JSON.stringify(response)}`);
        }
    }
    else if (result === undefined) {
        res.status(204).send();
    }
    else {
        res.send(result);
    }
}

function apiRoute(method, path, routeHandler) {
    route(method, path, [auth.checkApiAuth, csrfMiddleware], routeHandler, apiResultHandler);
}

function route(method, path, middleware, routeHandler, resultHandler, transactional = true) {
    router[method](path, ...middleware, async (req, res, next) => {
        try {
            const result = await cls.init(async () => {
                cls.namespace.set('sourceId', req.headers['trilium-source-id']);
                protectedSessionService.setProtectedSessionId(req);

                if (transactional) {
                    return await sql.transactional(async () => {
                        return await routeHandler(req, res, next);
                    });
                }
                else {
                    return await routeHandler(req, res, next);
                }
            });

            if (resultHandler) {
                resultHandler(req, res, result);
            }
        }
        catch (e) {
            log.error(`${method} ${path} threw exception: ` + e.stack);

            res.sendStatus(500);
        }
    });
}

const GET = 'get', POST = 'post', PUT = 'put', DELETE = 'delete';
const uploadMiddleware = multer.single('upload');

function register(app) {
    route(GET, '/', [auth.checkAuth, csrfMiddleware], indexRoute.index);
    route(GET, '/login', [auth.checkAppInitialized], loginRoute.loginPage);
    route(POST, '/login', [], loginRoute.login);
    route(POST, '/logout', [csrfMiddleware, auth.checkAuth], loginRoute.logout);
    route(GET, '/setup', [auth.checkAppNotInitialized], setupRoute.setupPage);

    apiRoute(GET, '/api/tree', treeApiRoute.getTree);
    apiRoute(POST, '/api/tree/load', treeApiRoute.load);
    apiRoute(PUT, '/api/branches/:branchId/set-prefix', branchesApiRoute.setPrefix);

    apiRoute(PUT, '/api/branches/:branchId/move-to/:parentNoteId', branchesApiRoute.moveBranchToParent);
    apiRoute(PUT, '/api/branches/:branchId/move-before/:beforeBranchId', branchesApiRoute.moveBranchBeforeNote);
    apiRoute(PUT, '/api/branches/:branchId/move-after/:afterBranchId', branchesApiRoute.moveBranchAfterNote);
    apiRoute(PUT, '/api/branches/:branchId/expanded/:expanded', branchesApiRoute.setExpanded);
    apiRoute(DELETE, '/api/branches/:branchId', branchesApiRoute.deleteBranch);

    apiRoute(GET, '/api/autocomplete', autocompleteApiRoute.getAutocomplete);

    apiRoute(GET, '/api/notes/:noteId', notesApiRoute.getNote);
    apiRoute(PUT, '/api/notes/:noteId', notesApiRoute.updateNote);
    apiRoute(DELETE, '/api/notes/:noteId', notesApiRoute.deleteNote);
    apiRoute(POST, '/api/notes/:parentNoteId/children', notesApiRoute.createNote);
    apiRoute(GET, '/api/notes/:parentNoteId/children', notesApiRoute.getChildren);
    apiRoute(PUT, '/api/notes/:noteId/sort', notesApiRoute.sortNotes);
    apiRoute(PUT, '/api/notes/:noteId/protect/:isProtected', notesApiRoute.protectSubtree);
    apiRoute(PUT, /\/api\/notes\/(.*)\/type\/(.*)\/mime\/(.*)/, notesApiRoute.setNoteTypeMime);
    apiRoute(GET, '/api/notes/:noteId/revisions', noteRevisionsApiRoute.getNoteRevisions);
    apiRoute(POST, '/api/notes/relation-map', notesApiRoute.getRelationMap);
    apiRoute(PUT, '/api/notes/:noteId/change-title', notesApiRoute.changeTitle);

    apiRoute(PUT, '/api/notes/:noteId/clone-to/:parentNoteId', cloningApiRoute.cloneNoteToParent);
    apiRoute(PUT, '/api/notes/:noteId/clone-after/:afterBranchId', cloningApiRoute.cloneNoteAfter);

    route(GET, '/api/notes/:branchId/export/:type/:format/:version/:exportId', [auth.checkApiAuthOrElectron], exportRoute.exportBranch);
    route(POST, '/api/notes/:parentNoteId/import', [auth.checkApiAuthOrElectron, uploadMiddleware, csrfMiddleware], importRoute.importToBranch, apiResultHandler);

    route(POST, '/api/notes/:parentNoteId/upload', [auth.checkApiAuthOrElectron, uploadMiddleware, csrfMiddleware],
        filesRoute.uploadFile, apiResultHandler);

    route(GET, '/api/notes/:noteId/download', [auth.checkApiAuthOrElectron], filesRoute.downloadFile);
    // this "hacky" path is used for easier referencing of CSS resources
    route(GET, '/api/notes/download/:noteId', [auth.checkApiAuthOrElectron], filesRoute.downloadFile);

    apiRoute(GET, '/api/notes/:noteId/attributes', attributesRoute.getEffectiveNoteAttributes);
    apiRoute(PUT, '/api/notes/:noteId/attributes', attributesRoute.updateNoteAttributes);
    apiRoute(PUT, '/api/notes/:noteId/attribute', attributesRoute.updateNoteAttribute);
    apiRoute(PUT, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.createRelation);
    apiRoute(DELETE, '/api/notes/:noteId/relations/:name/to/:targetNoteId', attributesRoute.deleteRelation);
    apiRoute(DELETE, '/api/notes/:noteId/attributes/:attributeId', attributesRoute.deleteNoteAttribute);
    apiRoute(GET, '/api/attributes/names', attributesRoute.getAttributeNames);
    apiRoute(GET, '/api/attributes/values/:attributeName', attributesRoute.getValuesForAttribute);

    apiRoute(POST, '/api/notes/:noteId/link-map', linkMapRoute.getLinkMap);

    apiRoute(GET, '/api/date-notes/date/:date', dateNotesRoute.getDateNote);
    apiRoute(GET, '/api/date-notes/month/:month', dateNotesRoute.getMonthNote);
    apiRoute(GET, '/api/date-notes/year/:year', dateNotesRoute.getYearNote);

    route(GET, '/api/images/:noteId/:filename', [auth.checkApiAuthOrElectron], imageRoute.returnImage);
    route(POST, '/api/images', [auth.checkApiAuthOrElectron, uploadMiddleware, csrfMiddleware], imageRoute.uploadImage, apiResultHandler);

    apiRoute(GET, '/api/recent-changes', recentChangesApiRoute.getRecentChanges);

    apiRoute(GET, '/api/options', optionsApiRoute.getOptions);
    // FIXME: possibly change to sending value in the body to avoid host of HTTP server issues with slashes
    apiRoute(PUT, '/api/options/:name/:value*', optionsApiRoute.updateOption);
    apiRoute(PUT, '/api/options', optionsApiRoute.updateOptions);
    apiRoute(GET, '/api/options/user-themes', optionsApiRoute.getUserThemes);

    apiRoute(POST, '/api/password/change', passwordApiRoute.changePassword);

    apiRoute(POST, '/api/sync/test', syncApiRoute.testSync);
    apiRoute(POST, '/api/sync/now', syncApiRoute.syncNow);
    apiRoute(POST, '/api/sync/fill-sync-rows', syncApiRoute.fillSyncRows);
    apiRoute(POST, '/api/sync/force-full-sync', syncApiRoute.forceFullSync);
    apiRoute(POST, '/api/sync/force-note-sync/:noteId', syncApiRoute.forceNoteSync);
    route(GET, '/api/sync/check', [auth.checkApiAuth], syncApiRoute.checkSync, apiResultHandler);
    route(GET, '/api/sync/changed', [auth.checkApiAuth], syncApiRoute.getChanged, apiResultHandler);
    route(PUT, '/api/sync/update', [auth.checkApiAuth], syncApiRoute.update, apiResultHandler);
    route(POST, '/api/sync/finished', [auth.checkApiAuth], syncApiRoute.syncFinished, apiResultHandler);
    route(GET, '/api/sync/stats', [], syncApiRoute.getStats, apiResultHandler);

    apiRoute(GET, '/api/event-log', eventLogRoute.getEventLog);

    apiRoute(POST, '/api/recent-notes', recentNotesRoute.addRecentNote);
    apiRoute(GET, '/api/app-info', appInfoRoute.getAppInfo);

    // group of services below are meant to be executed from outside
    route(GET, '/api/setup/status', [], setupApiRoute.getStatus, apiResultHandler);
    route(POST, '/api/setup/new-document', [auth.checkAppNotInitialized], setupApiRoute.setupNewDocument, apiResultHandler);
    route(POST, '/api/setup/sync-from-server', [auth.checkAppNotInitialized], setupApiRoute.setupSyncFromServer, apiResultHandler, false);
    route(GET, '/api/setup/sync-seed', [auth.checkBasicAuth], setupApiRoute.getSyncSeed, apiResultHandler);
    route(POST, '/api/setup/sync-seed', [auth.checkAppNotInitialized], setupApiRoute.saveSyncSeed, apiResultHandler, false);

    apiRoute(GET, '/api/sql/schema', sqlRoute.getSchema);
    apiRoute(POST, '/api/sql/execute', sqlRoute.execute);
    apiRoute(POST, '/api/anonymization/anonymize', anonymizationRoute.anonymize);

    apiRoute(POST, '/api/cleanup/cleanup-unused-images', cleanupRoute.cleanupUnusedImages);
    // VACUUM requires execution outside of transaction
    route(POST, '/api/cleanup/vacuum-database', [auth.checkApiAuthOrElectron, csrfMiddleware], cleanupRoute.vacuumDatabase, apiResultHandler, false);

    apiRoute(POST, '/api/script/exec', scriptRoute.exec);
    apiRoute(POST, '/api/script/run/:noteId', scriptRoute.run);
    apiRoute(GET, '/api/script/startup', scriptRoute.getStartupBundles);
    apiRoute(GET, '/api/script/bundle/:noteId', scriptRoute.getBundle);
    apiRoute(GET, '/api/script/relation/:noteId/:relationName', scriptRoute.getRelationBundles);

    // no CSRF since this is called from android app
    route(POST, '/api/sender/login', [], loginApiRoute.token, apiResultHandler);
    route(POST, '/api/sender/image', [auth.checkToken, uploadMiddleware], senderRoute.uploadImage, apiResultHandler);
    route(POST, '/api/sender/note', [auth.checkToken], senderRoute.saveNote, apiResultHandler);

    apiRoute(GET, '/api/search/:searchString', searchRoute.searchNotes);
    apiRoute(GET, '/api/search-note/:noteId', searchRoute.searchFromNote);

    route(POST, '/api/login/sync', [], loginApiRoute.loginSync, apiResultHandler);
    // this is for entering protected mode so user has to be already logged-in (that's the reason we don't require username)
    apiRoute(POST, '/api/login/protected', loginApiRoute.loginToProtectedSession);
    route(POST, '/api/login/token', [], loginApiRoute.token, apiResultHandler);

    // in case of local electron, local calls are allowed unauthenticated, for server they need auth
    const clipperMiddleware = utils.isElectron() ? [] : [auth.checkToken];

    route(GET, '/api/clipper/handshake', clipperMiddleware, clipperRoute.handshake, apiResultHandler);
    route(POST, '/api/clipper/clippings', clipperMiddleware, clipperRoute.addClipping, apiResultHandler);
    route(POST, '/api/clipper/notes', clipperMiddleware, clipperRoute.createNote, apiResultHandler);
    route(POST, '/api/clipper/open/:noteId', clipperMiddleware, clipperRoute.openNote, apiResultHandler);

    app.use('', router);
}

module.exports = {
    register
};