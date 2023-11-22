const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const sessionParser = require('./routes/session_parser.js');
const utils = require('./services/utils.js');

require('./services/handlers.js');
require('./becca/becca_loader.js');

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
app.use(`/manifest.webmanifest`, express.static(path.join(__dirname, 'public/manifest.webmanifest')));
app.use(`/robots.txt`, express.static(path.join(__dirname, 'public/robots.txt')));
app.use(sessionParser);
app.use(favicon(`${__dirname}/../images/app-icons/win/icon.ico`));

require('./routes/assets.js').register(app);
require('./routes/routes.js').register(app);
require('./routes/custom.js').register(app);
require('./routes/error_handlers.js').register(app);

// triggers sync timer
require('./services/sync.js');

// triggers backup timer
require('./services/backup.js');

// trigger consistency checks timer
require('./services/consistency_checks.js');

require('./services/scheduler.js');

if (utils.isElectron()) {
    require('@electron/remote/main').initialize();
}

module.exports = app;
