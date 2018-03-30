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

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const cls = require('../services/cls');
const sql = require('../services/sql');

function apiRoute(method, path, handler) {
    router[method](path, auth.checkApiAuth, async (req, res, next) => {
        try {
            const resp = await cls.init(async () => {
                return await sql.doInTransaction(async () => {
                    return await handler(req, res, next);
                });
            });

            if (Array.isArray(resp)) {
                res.status(resp[0]).send(resp[1]);
            }
            else if (resp === undefined) {
                res.status(200);
            }
            else {
                res.status(200).send(resp);
            }
        }
        catch (e) {
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

    app.use('/api/notes', cloningApiRoute);
    app.use('/api', labelsRoute);
    app.use('/api/notes-revisions', noteRevisionsApiRoute);
    app.use('/api/recent-changes', recentChangesApiRoute);
    app.use('/api/settings', settingsApiRoute);
    app.use('/api/password', passwordApiRoute);
    app.use('/api/migration', migrationApiRoute);
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
}

module.exports = {
    register
};