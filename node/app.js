const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const session = require('express-session');

const appRoute = require('./routes/app');
const loginRoute = require('./routes/login');
const logoutRoute = require('./routes/logout');
const migrationRoute = require('./routes/migration');

// API routes
const treeRoute = require('./routes/tree');
const notesRoute = require('./routes/notes');
const notesMoveRoute = require('./routes/notes_move');
const auditRoute = require('./routes/audit');
const noteHistoryRoute = require('./routes/note_history');
const recentChangesRoute = require('./routes/recent_changes');
const settingsRoute = require('./routes/settings');
const passwordRoute = require('./routes/password');

const db = require('sqlite');

const config = require('./config');

db.open(config.Document.documentPath, { Promise });

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(helmet());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../static')));
app.use(session({
    secret: "sdhkjhdsklajf", // FIXME: need to use the DB one
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
    //    path: "/",
        httpOnly: true,
        maxAge:  1800000
    }
}));
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use('/app', appRoute);
app.use('/login', loginRoute);
app.use('/logout', logoutRoute);
app.use('/migration', migrationRoute);

app.use('/api/tree', treeRoute);
app.use('/api/notes', notesRoute);
app.use('/api/notes', notesMoveRoute);
app.use('/api/audit', auditRoute);
app.use('/api/notes-history', noteHistoryRoute);
app.use('/api/recent-changes', recentChangesRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/password', passwordRoute);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;