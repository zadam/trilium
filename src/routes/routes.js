const indexRoute = require('./index');
const loginRoute = require('./login');
const logoutRoute = require('./logout');
const migrationRoute = require('./migration');
const setupRoute = require('./setup');

// API routes
const treeApiRoute = require('./api/tree');
const notesApiRoute = require('./api/notes');
const treeChangesApiRoute = require('./api/tree_changes');
const cloningApiRoute = require('./api/cloning');
const noteRevisionsApiRoute = require('./api/note_revisions');
const recentChangesApiRoute = require('./api/recent_changes');
const settingsApiRoute = require('./api/settings');
const passwordApiRoute = require('./api/password');
const migrationApiRoute = require('./api/migration');
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
const labelsRoute = require('./api/labels');
const scriptRoute = require('./api/script');
const senderRoute = require('./api/sender');
const filesRoute = require('./api/file_upload');
const searchRoute = require('./api/search');

const log = require('../services/log');
const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const cls = require('../services/cls');
const sql = require('../services/sql');

function apiRoute(method, path, handler) {
    router[method](path, auth.checkApiAuth, async (req, res, next) => {
        try {
            const result = await cls.init(async () => {
                cls.namespace.set('sourceId', req.headers.source_id);

                return await sql.doInTransaction(async () => {
                    return await handler(req, res, next);
                });
            });

            // if it's an array and first element is integer then we consider this to be [statusCode, response] format
            if (Array.isArray(result) && result.length > 0 && Number.isInteger(result[0])) {
                const [statusCode, response] = result;

                res.status(statusCode).send(response);

                if (statusCode !== 200) {
                    log.info(`${method} ${path} returned ${statusCode} with response ${JSON.stringify(response)}`);
                }
            }
            else if (result === undefined) {
                res.status(200).send();
            }
            else {
                res.status(200).send(result);
            }
        }
        catch (e) {
            log.info(`${method} ${path} threw exception: ` + e.stack);

            res.send(500);

            next(e);
        }
    });
}

const GET = 'get', POST = 'post', PUT = 'put', DELETE = 'delete';

function register(app) {
    app.use('/', indexRoute);
    app.use('/login', loginRoute);
    app.use('/logout', logoutRoute);
    app.use('/migration', migrationRoute);
    app.use('/setup', setupRoute);

    apiRoute(GET, '/api/tree', treeApiRoute.getTree);
    apiRoute(PUT, '/api/tree/:branchId/set-prefix', treeApiRoute.setPrefix);

    apiRoute(PUT, '/api/tree/:branchId/move-to/:parentNoteId', treeChangesApiRoute.moveBranchToParent);
    apiRoute(PUT, '/api/tree/:branchId/move-before/:beforeBranchId', treeChangesApiRoute.moveBranchBeforeNote);
    apiRoute(PUT, '/api/tree/:branchId/move-after/:afterBranchId', treeChangesApiRoute.moveBranchAfterNote);
    apiRoute(PUT, '/api/tree/:branchId/expanded/:expanded', treeChangesApiRoute.setExpanded);
    apiRoute(DELETE, '/api/tree/:branchId', treeChangesApiRoute.deleteBranch);

    apiRoute(GET, '/api/notes/:noteId', notesApiRoute.getNote);
    apiRoute(PUT, '/api/notes/:noteId', notesApiRoute.updateNote);
    apiRoute(POST, '/api/notes/:parentNoteId/children', notesApiRoute.createNote);
    apiRoute(PUT, '/api/notes/:noteId/sort', notesApiRoute.sortNotes);
    apiRoute(PUT, '/api/notes/:noteId/protect-sub-tree/:isProtected', notesApiRoute.protectBranch);
    apiRoute(PUT, /\/api\/notes\/(.*)\/type\/(.*)\/mime\/(.*)/, notesApiRoute.setNoteTypeMime);

    apiRoute(PUT, '/api/notes/:childNoteId/clone-to/:parentNoteId', cloningApiRoute.cloneNoteToParent);
    apiRoute(PUT, '/api/notes/:noteId/clone-after/:afterBranchId', cloningApiRoute.cloneNoteAfter);

    apiRoute(GET, '/api/notes/:noteId/labels', labelsRoute.getNoteLabels);
    apiRoute(PUT, '/api/notes/:noteId/labels', labelsRoute.updateNoteLabels);
    apiRoute(GET, '/api/labels/names', labelsRoute.getAllLabelNames);
    apiRoute(GET, '/api/labels/values/:labelName', labelsRoute.getValuesForLabel);

    apiRoute(GET, '/api/note-revisions/:noteId', noteRevisionsApiRoute.getNoteRevisions);

    apiRoute(GET, '/api/recent-changes', recentChangesApiRoute.getRecentChanges);

    apiRoute(GET, '/api/settings', settingsApiRoute.getAllowedSettings);
    apiRoute(GET, '/api/settings/all', settingsApiRoute.getAllSettings);
    apiRoute(POST, '/api/settings', settingsApiRoute.updateSetting);

    apiRoute(POST, '/api/password/change', passwordApiRoute.changePassword);

    app.use('/api/sync', syncApiRoute);
    app.use('/api/login', loginApiRoute);
    app.use('/api/event-log', eventLogRoute);
    app.use('/api/recent-notes', recentNotesRoute);
    app.use('/api/app-info', appInfoRoute);
    app.use('/api/export', exportRoute);
    app.use('/api/import', importRoute);
    app.use('/api/setup', setupApiRoute);
    app.use('/api/sql', sqlRoute);
    app.use('/api/anonymization', anonymizationRoute);
    app.use('/api/cleanup', cleanupRoute);
    app.use('/api/images', imageRoute);
    app.use('/api/script', scriptRoute);
    app.use('/api/sender', senderRoute);
    app.use('/api/files', filesRoute);
    app.use('/api/search', searchRoute);

    app.use('', router);


    app.use('/api/migration', migrationApiRoute);
}

module.exports = {
    register
};