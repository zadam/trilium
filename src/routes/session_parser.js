import session from 'express-session';
import sessionSecret from '../services/session_secret.js'
import dataDir from '../services/data_dir.js'
import FileStoreFactory from 'session-file-store';
const FileStore = FileStoreFactory(session);

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

export default sessionParser;
