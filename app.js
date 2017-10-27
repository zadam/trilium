const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const os = require('os');
const log = require('./services/log');

const indexRoute = require('./routes/index');
const loginRoute = require('./routes/login');
const logoutRoute = require('./routes/logout');
const migrationRoute = require('./routes/migration');

// API routes
const treeApiRoute = require('./routes/api/tree');
const notesApiRoute = require('./routes/api/notes');
const notesMoveApiRoute = require('./routes/api/notes_move');
const auditApiRoute = require('./routes/api/audit');
const noteHistoryApiRoute = require('./routes/api/note_history');
const recentChangesApiRoute = require('./routes/api/recent_changes');
const settingsApiRoute = require('./routes/api/settings');
const passwordApiRoute = require('./routes/api/password');
const migrationApiRoute = require('./routes/api/migration');
const syncApiRoute = require('./routes/api/sync');

const dataDir = require('./services/data_dir');
const sessionSecret = require('./services/session_secret');

const db = require('sqlite');

const config = require('./services/config');

db.open(dataDir.DOCUMENT_PATH, { Promise });

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(helmet());

app.use((req, res, next) => {
    log.request(req);
    next();
});

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: sessionSecret,
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
    //    path: "/",
        httpOnly: true,
        maxAge:  1800000
    },
    store: new FileStore({
        ttl: 30 * 24 * 3600,
        path: os.tmpdir() + '/trilium-sessions'
    })
}));

app.use(favicon(__dirname + '/public/images/app-icons/favicon.ico'));

app.use('/', indexRoute);
app.use('/login', loginRoute);
app.use('/logout', logoutRoute);
app.use('/migration', migrationRoute);

app.use('/api/tree', treeApiRoute);
app.use('/api/notes', notesApiRoute);
app.use('/api/notes', notesMoveApiRoute);
app.use('/api/audit', auditApiRoute);
app.use('/api/notes-history', noteHistoryApiRoute);
app.use('/api/recent-changes', recentChangesApiRoute);
app.use('/api/settings', settingsApiRoute);
app.use('/api/password', passwordApiRoute);
app.use('/api/migration', migrationApiRoute);
app.use('/api/sync', syncApiRoute);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    log.error(err.message);
});

require('./services/sync');

module.exports = app;