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
const noteHistoryApiRoute = require('./api/note_history');
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
const attributesRoute = require('./api/attributes');
const scriptRoute = require('./api/script');
const senderRoute = require('./api/sender');

function register(app) {
    app.use('/', indexRoute);
    app.use('/login', loginRoute);
    app.use('/logout', logoutRoute);
    app.use('/migration', migrationRoute);
    app.use('/setup', setupRoute);

    app.use('/api/tree', treeApiRoute);
    app.use('/api/notes', notesApiRoute);
    app.use('/api/tree', treeChangesApiRoute);
    app.use('/api/notes', cloningApiRoute);
    app.use('/api', attributesRoute);
    app.use('/api/notes-history', noteHistoryApiRoute);
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
}

module.exports = {
    register
};