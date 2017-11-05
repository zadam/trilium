const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const os = require('os');
const options = require('./services/options');
const log = require('./services/log');
const utils = require('./services/utils');
const sql = require('./services/sql');

const dataDir = require('./services/data_dir');
const sessionSecret = require('./services/session_secret');

const db = require('sqlite');

db.open(dataDir.DOCUMENT_PATH, { Promise }).then(async () => {
    const tableResults = await sql.getResults("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'");

    console.log(tableResults);

    if (tableResults.length !== 1) {
        console.log("No connection to initialized DB.");
        process.exit(1);
    }

    if (!await options.getOption('document_id')) {
        await options.setOption('document_id', utils.randomString(32));
    }

    if (!await options.getOption('document_secret')) {
        await options.setOption('document_secret', utils.randomSecureToken(32));
    }
})
    .catch(e => {
        console.log("Error connecting to DB.", e);
        process.exit(1);
    });

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

require('./routes/routes').register(app);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Router not found for request ' + req.url);
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    log.error(err.message);

    res.status(err.status || 500);
    res.send({
        message: err.message
    });
});

// triggers sync timer
require('./services/sync');

// triggers backup timer
require('./services/backup');

module.exports = app;