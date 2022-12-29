const log = require('./services/log');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const session = require('express-session');
const compression = require('compression')
const FileStore = require('session-file-store')(session);
const sessionSecret = require('./services/session_secret');
const dataDir = require('./services/data_dir');
const utils = require('./services/utils');
const assetPath = require('./services/asset_path');
require('./services/handlers');
require('./becca/becca_loader');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

if (!utils.isElectron()) {
    app.use(compression()); // HTTP compression
}

app.use(helmet({
    hidePoweredBy: false, // errors out in electron
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.text({limit: '500mb'}));
app.use(express.json({limit: '500mb'}));
app.use(express.raw({limit: '500mb'}));
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public/root')));
app.use(`/${assetPath}/app`, express.static(path.join(__dirname, 'public/app')));
app.use(`/${assetPath}/app-dist`, express.static(path.join(__dirname, 'public/app-dist')));
app.use(`/${assetPath}/fonts`, express.static(path.join(__dirname, 'public/fonts')));
app.use(`/assets/vX/fonts`, express.static(path.join(__dirname, 'public/fonts')));
app.use(`/${assetPath}/stylesheets`, express.static(path.join(__dirname, 'public/stylesheets')));
app.use(`/assets/vX/stylesheets`, express.static(path.join(__dirname, 'public/stylesheets')));
app.use(`/${assetPath}/libraries`, express.static(path.join(__dirname, '..', 'libraries')));
app.use(`/assets/vX/libraries`, express.static(path.join(__dirname, '..', 'libraries')));
// excalidraw-view mode in shared notes
app.use(`/${assetPath}/node_modules/react/umd/react.production.min.js`, express.static(path.join(__dirname, '..', 'node_modules/react/umd/react.production.min.js')));
app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.production.min.js`, express.static(path.join(__dirname, '..', 'node_modules/react-dom/umd/react-dom.production.min.js')));
// expose whole dist folder since complete assets are needed in edit and share
app.use(`/node_modules/@excalidraw/excalidraw/dist/`, express.static(path.join(__dirname, '..', 'node_modules/@excalidraw/excalidraw/dist/')));
app.use(`/${assetPath}/node_modules/@excalidraw/excalidraw/dist/`, express.static(path.join(__dirname, '..', 'node_modules/@excalidraw/excalidraw/dist/')));
app.use(`/${assetPath}/images`, express.static(path.join(__dirname, '..', 'images')));
app.use(`/assets/vX/images`, express.static(path.join(__dirname, '..', 'images')));
app.use(`/manifest.webmanifest`, express.static(path.join(__dirname, 'public/manifest.webmanifest')));
app.use(`/robots.txt`, express.static(path.join(__dirname, 'public/robots.txt')));
const sessionParser = session({
    secret: sessionSecret,
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
        //    path: "/",
        httpOnly: true,
        maxAge:  24 * 60 * 60 * 1000 // in milliseconds
    },
    name: 'trilium.sid',
    store: new FileStore({
        ttl: 30 * 24 * 3600,
        path: `${dataDir.TRILIUM_DATA_DIR}/sessions`
    })
});
app.use(sessionParser);

app.use(favicon(`${__dirname}/../images/app-icons/win/icon.ico`));

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
    const err = new Error(`Router not found for request ${req.url}`);
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    if (err && err.message && (
        (err.message.includes("Router not found for request") && err.message.includes(".js.map"))
        || (err.message.includes("Router not found for request") && err.message.includes(".css.map"))
    )) {
        // ignore
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

if (utils.isElectron()) {
    require('@electron/remote/main').initialize();
}

module.exports = {
    app,
    sessionParser
};
