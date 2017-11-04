const indexRoute = require('./index');
const loginRoute = require('./login');
const logoutRoute = require('./logout');
const migrationRoute = require('./migration');

// API routes
const treeApiRoute = require('./api/tree');
const notesApiRoute = require('./api/notes');
const notesMoveApiRoute = require('./api/notes_move');
const statusApiRoute = require('./api/status');
const noteHistoryApiRoute = require('./api/note_history');
const recentChangesApiRoute = require('./api/recent_changes');
const settingsApiRoute = require('./api/settings');
const passwordApiRoute = require('./api/password');
const migrationApiRoute = require('./api/migration');
const syncApiRoute = require('./api/sync');
const loginApiRoute = require('./api/login');
const eventLogRoute = require('./api/event_log');

function register(app) {
    app.use('/', indexRoute);
    app.use('/login', loginRoute);
    app.use('/logout', logoutRoute);
    app.use('/migration', migrationRoute);

    app.use('/api/tree', treeApiRoute);
    app.use('/api/notes', notesApiRoute);
    app.use('/api/notes', notesMoveApiRoute);
    app.use('/api/status', statusApiRoute);
    app.use('/api/notes-history', noteHistoryApiRoute);
    app.use('/api/recent-changes', recentChangesApiRoute);
    app.use('/api/settings', settingsApiRoute);
    app.use('/api/password', passwordApiRoute);
    app.use('/api/migration', migrationApiRoute);
    app.use('/api/sync', syncApiRoute);
    app.use('/api/login', loginApiRoute);
    app.use('/api/event-log', eventLogRoute);
}

module.exports = {
    register
};