const log = require('./log');
const dataDir = require('./data_dir');
const fs = require('fs');
const sqlite = require('sqlite');
const resourceDir = require('./resource_dir');
const appInfo = require('./app_info');
const sql = require('./sql');
const cls = require('./cls');

async function createConnection() {
    return await sqlite.open(dataDir.DOCUMENT_PATH, {Promise});
}

let schemaReadyResolve = null;
const schemaReady = new Promise((resolve, reject) => schemaReadyResolve = resolve);

let dbReadyResolve = null;
const dbReady = new Promise((resolve, reject) => {
    cls.init(async () => {
        const db = await createConnection();
        sql.setDbConnection(db);

        await sql.execute("PRAGMA foreign_keys = ON");

        dbReadyResolve = () => {
            log.info("DB ready.");

            resolve(db);
        };

        const tableResults = await sql.getRows("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'");
        if (tableResults.length !== 1) {
            await createInitialDatabase();
        }

        schemaReadyResolve();

        if (!await isUserInitialized()) {
            log.info("Login/password not initialized. DB not ready.");

            return;
        }

        if (!await isDbUpToDate()) {
            return;
        }

        resolve(db);
    });
});

async function createInitialDatabase() {
    log.info("Connected to db, but schema doesn't exist. Initializing schema ...");

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');
    const notesSql = fs.readFileSync(resourceDir.DB_INIT_DIR + '/main_notes.sql', 'UTF-8');
    const notesTreeSql = fs.readFileSync(resourceDir.DB_INIT_DIR + '/main_branches.sql', 'UTF-8');
    const imagesSql = fs.readFileSync(resourceDir.DB_INIT_DIR + '/main_images.sql', 'UTF-8');
    const notesImageSql = fs.readFileSync(resourceDir.DB_INIT_DIR + '/main_note_images.sql', 'UTF-8');

    await sql.transactional(async () => {
        await sql.executeScript(schema);
        await sql.executeScript(notesSql);
        await sql.executeScript(notesTreeSql);
        await sql.executeScript(imagesSql);
        await sql.executeScript(notesImageSql);

        const startNoteId = await sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");

        await require('./options').initOptions(startNoteId);
        await require('./sync_table').fillAllSyncRows();
    });

    log.info("Schema and initial content generated. Waiting for user to enter username/password to finish setup.");

    // we don't resolve dbReady promise because user needs to setup the username and password to initialize
    // the database
}

function setDbReadyAsResolved() {
    dbReadyResolve();
}

async function isDbUpToDate() {
    const dbVersion = parseInt(await sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info("App db version is " + appInfo.dbVersion + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

async function isUserInitialized() {
    const username = await sql.getValue("SELECT value FROM options WHERE name = 'username'");

    return !!username;
}

module.exports = {
    dbReady,
    schemaReady,
    isUserInitialized,
    setDbReadyAsResolved,
    isDbUpToDate
};