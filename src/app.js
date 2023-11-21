import express from 'express';
import path from 'path';
import favicon from 'serve-favicon';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import sessionParser from './routes/session_parser.js'
import utils from './services/utils.js'
import './services/handlers.js';
import './becca/becca_loader.js';

// triggers sync timer
import './services/sync.js';

// triggers backup timer
import './services/backup.js';

// trigger consistency checks timer
import './services/consistency_checks.js';

import './services/scheduler.js';

import assetRoutes from './routes/assets.js'

import routes from './routes/routes.js'

import customRoutes from './routes/custom.js'

import errorHandlerRoutes from './routes/error_handlers.js'

import {initialize} from "@electron/remote/main/index.js";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

assetRoutes.register(app);
routes.register(app);
customRoutes.register(app);
errorHandlerRoutes.register(app);

if (utils.isElectron()) {
    initialize();
}

export default app;
