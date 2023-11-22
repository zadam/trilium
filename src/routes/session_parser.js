const session = require("express-session");
const sessionSecret = require('../services/session_secret.js');
const dataDir = require('../services/data_dir.js');
const FileStore = require('session-file-store')(session);

const sessionParser = session({
    secret: sessionSecret,
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
        //    path: "/",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // in milliseconds
    },
    name: 'trilium.sid',
    store: new FileStore({
        ttl: 30 * 24 * 3600,
        path: `${dataDir.TRILIUM_DATA_DIR}/sessions`
    })
});

module.exports = sessionParser;
