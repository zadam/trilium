import express = require('express');
import path = require('path');
import favicon = require('serve-favicon');
import cookieParser = require('cookie-parser');
import helmet = require('helmet');
import compression = require('compression');
import sessionParser = require('./routes/session_parser');
import utils = require('./services/utils');

require('./services/handlers');
require('./becca/becca_loader');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

if (!utils.isElectron()) {
    app.use(compression()); // HTTP compression
}

app.use(helmet.default({
    hidePoweredBy: false, // errors out in electron
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.text({ limit: '500mb' }));
app.use(express.json({ limit: '500mb' }));
app.use(express.raw({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public/root')));
app.use(`/manifest.webmanifest`, express.static(path.join(__dirname, 'public/manifest.webmanifest')));
app.use(`/robots.txt`, express.static(path.join(__dirname, 'public/robots.txt')));
app.use(sessionParser);
app.use(favicon(`${__dirname}/../images/app-icons/win/icon.ico`));

require('./routes/assets').register(app);
require('./routes/routes').register(app);
require('./routes/custom').register(app);
require('./routes/error_handlers').register(app);

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

export = app;
