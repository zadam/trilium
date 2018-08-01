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

app.use(helmet());

app.use((req, res, next) => {
    log.request(req);
    next();
});

app.use((req, res, next) => {
    cls.namespace.bindEmitter(req);
    cls.namespace.bindEmitter(res);

    cls.init(() => {
        cls.namespace.set("Hi");

        next();
    });
});

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
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

app.use(favicon(__dirname + '/public/images/app-icons/win/icon.ico'));

require('./routes/routes').register(app);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Router not found for request ' + req.url);
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    log.info(err);

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