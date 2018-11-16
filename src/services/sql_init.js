const log = require('./log');
const dataDir = require('./data_dir');
const fs = require('fs');
const sqlite = require('sqlite');
const resourceDir = require('./resource_dir');
const appInfo = require('./app_info');
const sql = require('./sql');
const cls = require('./cls');
const optionService = require('./options');
const Option = require('../entities/option');

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

async function schemaExists() {
    const tableResults = await sql.getRows("SELECT name FROM sqlite_master WHERE type='table' AND name='options'");

    return tableResults.length === 1;
}

async function isDbInitialized() {
    if (!await schemaExists()) {
        return false;
    }

    const initialized = await sql.getValue("SELECT value FROM options WHERE name = 'initialized'");

    // !initialized may be removed in the future, required only for migration
    return !initialized || initialized === 'true';
}

async function initDbConnection() {
    await cls.init(async () => {
        if (!await isDbInitialized()) {
            log.info("DB not initialized, please visit setup page to see instructions on how to initialize Trilium.");

            return;
        }

        await sql.execute("PRAGMA foreign_keys = ON");

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

    if (await isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');
    const demoFile = fs.readFileSync(resourceDir.DB_INIT_DIR + '/demo.tar');

    await sql.transactional(async () => {
        await sql.executeScript(schema);

        const Note = require("../entities/note");
        const Branch = require("../entities/branch");

        const rootNote = await new Note({
            noteId: 'root',
            title: 'root',
            content: '',
            type: 'text',
            mime: 'text/html'
        }).save();

        await new Branch({
            branchId: 'root',
            noteId: 'root',
            parentNoteId: 'none',
            isExpanded: true,
            notePosition: 0
        }).save();

        const tarImportService = require("./import/tar");
        await tarImportService.importTar(demoFile, rootNote);

        const startNoteId = await sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");

        const optionsInitService = require('./options_init');

        await optionsInitService.initDocumentOptions();
        await optionsInitService.initSyncedOptions(username, password);
        await optionsInitService.initNotSyncedOptions(true, startNoteId);

        await require('./sync_table').fillAllSyncRows();
    });

    log.info("Schema and initial content generated.");

    await initDbConnection();
}

async function createDatabaseForSync(options, syncServerHost = '', syncProxy = '') {
    log.info("Creating database for sync");

    if (await isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');

    await sql.transactional(async () => {
        await sql.executeScript(schema);

        await require('./options_init').initNotSyncedOptions(false, 'root', syncServerHost, syncProxy);

        // document options required for sync to kick off
        for (const opt of options) {
            await new Option(opt).save();
        }
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

async function dbInitialized() {
    await optionService.setOption('initialized', 'true');

    await initDbConnection();
}

module.exports = {
    dbReady,
    schemaExists,
    isDbInitialized,
    initDbConnection,
    isDbUpToDate,
    createInitialDatabase,
    createDatabaseForSync,
    dbInitialized
};