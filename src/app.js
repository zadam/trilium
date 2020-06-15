const log = require('./services/log');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const os = require('os');
const sessionSecret = require('./services/session_secret');
const cls = require('./services/cls');
require('./entities/entity_constructor');
require('./services/handlers');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(helmet({
    hidePoweredBy: false // deactivated because electron 4.0 crashes on this right after startup
}));

app.use((req, res, next) => {
    log.request(req);
    next();
});

app.use(bodyParser.json({limit: '500mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libraries', express.static(path.join(__dirname, '..', 'libraries')));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));
const sessionParser = session({
    secret: sessionSecret,
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
        //    path: "/",
        httpOnly: true,
        maxAge:  24 * 60 * 60 * 1000 // in milliseconds
    },
    store: new FileStore({
        ttl: 30 * 24 * 3600,
        path: os.tmpdir() + '/trilium-sessions'
    })
});
app.use(sessionParser);

app.use(favicon(__dirname + '/../images/app-icons/win/icon.ico'));

require('./routes/routes').register(app);

require('./routes/custom').register(app);

app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') {
        return next(err);
    }

    log.error(`Invalid CSRF token: ${req.headers['x-csrf-token']}, secret: ${req.cookies['_csrf']}`);

    err = new Error('Invalid CSRF token');
    err.status = 403;
    next(err);
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Router not found for request ' + req.url);
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    if (err && err.message && (
        err.message.includes("Invalid package")
        || (err.message.includes("Router not found for request") && err.message.includes("node_modules"))
        || (err.message.includes("Router not found for request") && err.message.includes(".js.map"))
        || (err.message.includes("Router not found for request") && err.message.includes(".css.map"))
    )) {
        // electron 6 outputs a lot of such errors which do not seem important
    }
    else {
        log.info(err);
    }

    res.status(err.status || 500);
    res.send({
        message: err.message
    });
});

// triggers sync timer
require('./services/sync');

// triggers backup timer
require('./services/backup');

// trigger consistency checks timer
require('./services/consistency_checks');

require('./services/scheduler');

module.exports = {
    app,
    sessionParser
};
