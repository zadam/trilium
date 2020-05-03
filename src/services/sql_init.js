const log = require('./log');
const dataDir = require('./data_dir');
const fs = require('fs');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const resourceDir = require('./resource_dir');
const appInfo = require('./app_info');
const sql = require('./sql');
const cls = require('./cls');
const utils = require('./utils');
const optionService = require('./options');
const port = require('./port');
const Option = require('../entities/option');
const TaskContext = require('./task_context.js');

const dbConnection = new Promise(async (resolve, reject) => {
    const db = await sqlite.open({
        filename: dataDir.DOCUMENT_PATH,
        driver: sqlite3.Database
    });

    db.run('PRAGMA journal_mode = WAL;');

    sql.setDbConnection(db);

    resolve();
});

let dbReadyResolve = null;
const dbReady = new Promise(async (resolve, reject) => {
    dbReadyResolve = resolve;

    await dbConnection;

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
            log.info(`DB not initialized, please visit setup page` + (utils.isElectron() ? '' : ` - http://[your-server-host]:${await port} to see instructions on how to initialize Trilium.`));

            return;
        }

        const currentDbVersion = await getDbVersion();

        if (currentDbVersion > appInfo.dbVersion) {
            log.error(`Current DB version ${currentDbVersion} is newer than app db version ${appInfo.dbVersion} which means that it was created by newer and incompatible version of Trilium. Upgrade to latest version of Trilium to resolve this issue.`);

            utils.crash();
        }

        if (!await isDbUpToDate()) {
            // avoiding circular dependency
            const migrationService = require('./migration');

            await migrationService.migrate();
        }

        await require('./options_init').initStartupOptions();

        log.info("DB ready.");
        dbReadyResolve();
    });
}

async function createInitialDatabase(username, password, theme) {
    log.info("Creating initial database ...");

    if (await isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');
    const demoFile = fs.readFileSync(resourceDir.DB_INIT_DIR + '/demo.zip');

    await sql.transactional(async () => {
        await sql.executeScript(schema);

        const Note = require("../entities/note");
        const Branch = require("../entities/branch");

        const rootNote = await new Note({
            noteId: 'root',
            title: 'root',
            type: 'text',
            mime: 'text/html'
        }).save();

        await rootNote.setContent('');

        await new Branch({
            branchId: 'root',
            noteId: 'root',
            parentNoteId: 'none',
            isExpanded: true,
            notePosition: 10
        }).save();

        const dummyTaskContext = new TaskContext("1", 'import', false);

        const zipImportService = require("./import/zip");
        await zipImportService.importZip(dummyTaskContext, demoFile, rootNote);

        const startNoteId = await sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");

        const optionsInitService = require('./options_init');

        await optionsInitService.initDocumentOptions();
        await optionsInitService.initSyncedOptions(username, password);
        await optionsInitService.initNotSyncedOptions(true, startNoteId, { theme });

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

        await require('./options_init').initNotSyncedOptions(false, 'root', { syncServerHost, syncProxy });

        // document options required for sync to kick off
        for (const opt of options) {
            await new Option(opt).save();
        }
    });

    log.info("Schema and not synced options generated.");
}

async function getDbVersion() {
    return parseInt(await sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));
}

async function isDbUpToDate() {
    const dbVersion = await getDbVersion();

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info("App db version is " + appInfo.dbVersion + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

async function dbInitialized() {
    if (!await isDbInitialized()) {
        await optionService.setOption('initialized', 'true');

        await initDbConnection();
    }
}

dbReady.then(async () => {
    log.info("DB size: " + await sql.getValue("SELECT page_count * page_size / 1000 as size FROM pragma_page_count(), pragma_page_size()") + " KB");
});

module.exports = {
    dbReady,
    dbConnection,
    schemaExists,
    isDbInitialized,
    initDbConnection,
    isDbUpToDate,
    createInitialDatabase,
    createDatabaseForSync,
    dbInitialized
};