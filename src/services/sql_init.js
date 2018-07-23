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

let dbReadyResolve = null;
const dbReady = new Promise(async (resolve, reject) => {
    dbReadyResolve = resolve;

    // no need to create new connection now since DB stays the same all the time
    const db = await createConnection();
    sql.setDbConnection(db);

    initDbConnection();
});

async function isDbInitialized() {
    const tableResults = await sql.getRows("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'");

    return tableResults.length === 1;
}

async function initDbConnection() {
    await cls.init(async () => {
        await sql.execute("PRAGMA foreign_keys = ON");

        if (!await isDbInitialized()) {
            log.info("DB not initialized, please visit setup page to initialize Trilium.");

            return;
        }

        if (!await isDbUpToDate()) {
            // avoiding circular dependency
            const migrationService = require('./migration');

            await migrationService.migrate();
        }

        log.info("DB ready.");
        dbReadyResolve();
    });
}

async function createInitialDatabase(username, password) {
    log.info("Creating initial database ...");

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

        const optionsInitService = require('./options_init');

        await optionsInitService.initDocumentOptions();
        await optionsInitService.initSyncedOptions(username, password);
        await optionsInitService.initNotSyncedOptions(startNoteId);

        await require('./sync_table').fillAllSyncRows();
    });

    log.info("Schema and initial content generated.");

    await initDbConnection();
}

async function createDatabaseForSync(syncServerHost) {
    log.info("Creating database for sync with server ...");

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');

    await sql.transactional(async () => {
        await sql.executeScript(schema);

        await require('./options_init').initNotSyncedOptions('', syncServerHost);
    });

    log.info("Schema and not synced options generated.");
}

async function isDbUpToDate() {
    const dbVersion = parseInt(await sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info("App db version is " + appInfo.dbVersion + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

module.exports = {
    dbReady,
    isDbInitialized,
    initDbConnection,
    isDbUpToDate,
    createInitialDatabase,
    createDatabaseForSync
};