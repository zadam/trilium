const log = require('./log');
const dataDir = require('./data_dir');
const fs = require('fs');
const resourceDir = require('./resource_dir');
const appInfo = require('./app_info');
const sql = require('./sql');
const cls = require('./cls');
const utils = require('./utils');
const optionService = require('./options');
const port = require('./port');
const Option = require('../entities/option');
const TaskContext = require('./task_context.js');
const Database = require('better-sqlite3');

const dbConnection = new Database(dataDir.DOCUMENT_PATH);
dbConnection.pragma('journal_mode = WAL');

sql.setDbConnection(dbConnection);

const dbReady = initDbConnection();

function schemaExists() {
    const tableResults = sql.getRows("SELECT name FROM sqlite_master WHERE type='table' AND name='options'");

    return tableResults.length === 1;
}

function isDbInitialized() {
    if (!schemaExists()) {
        return false;
    }

    const initialized = sql.getValue("SELECT value FROM options WHERE name = 'initialized'");

    // !initialized may be removed in the future, required only for migration
    return !initialized || initialized === 'true';
}

function initDbConnection() {
    cls.init(() => {
        if (!isDbInitialized()) {
            log.info(`DB not initialized, please visit setup page` + (utils.isElectron() ? '' : ` - http://[your-server-host]:${port} to see instructions on how to initialize Trilium.`));

            return;
        }

        const currentDbVersion = getDbVersion();

        if (currentDbVersion > appInfo.dbVersion) {
            log.error(`Current DB version ${currentDbVersion} is newer than app db version ${appInfo.dbVersion} which means that it was created by newer and incompatible version of Trilium. Upgrade to latest version of Trilium to resolve this issue.`);

            utils.crash();
        }

        if (!isDbUpToDate()) {
            // avoiding circular dependency
            const migrationService = require('./migration');

            migrationService.migrate();
        }

        require('./options_init').initStartupOptions();
    });
}

function createInitialDatabase(username, password, theme) {
    log.info("Creating initial database ...");

    if (isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');
    const demoFile = fs.readFileSync(resourceDir.DB_INIT_DIR + '/demo.zip');

    sql.transactional(() => {
        sql.executeScript(schema);

        const Note = require("../entities/note");
        const Branch = require("../entities/branch");

        const rootNote = new Note({
            noteId: 'root',
            title: 'root',
            type: 'text',
            mime: 'text/html'
        }).save();

        rootNote.setContent('');

        new Branch({
            branchId: 'root',
            noteId: 'root',
            parentNoteId: 'none',
            isExpanded: true,
            notePosition: 10
        }).save();

        const dummyTaskContext = new TaskContext("1", 'import', false);

        const zipImportService = require("./import/zip");
        zipImportService.importZip(dummyTaskContext, demoFile, rootNote);

        const startNoteId = sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");

        const optionsInitService = require('./options_init');

        optionsInitService.initDocumentOptions();
        optionsInitService.initSyncedOptions(username, password);
        optionsInitService.initNotSyncedOptions(true, startNoteId, { theme });

        require('./sync_table').fillAllSyncRows();
    });

    log.info("Schema and initial content generated.");

    initDbConnection();
}

function createDatabaseForSync(options, syncServerHost = '', syncProxy = '') {
    log.info("Creating database for sync");

    if (isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');

    sql.transactional(() => {
        sql.executeScript(schema);

        require('./options_init').initNotSyncedOptions(false, 'root', { syncServerHost, syncProxy });

        // document options required for sync to kick off
        for (const opt of options) {
            new Option(opt).save();
        }
    });

    log.info("Schema and not synced options generated.");
}

function getDbVersion() {
    return parseInt(sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));
}

function isDbUpToDate() {
    const dbVersion = getDbVersion();

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info("App db version is " + appInfo.dbVersion + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

function dbInitialized() {
    if (!isDbInitialized()) {
        optionService.setOption('initialized', 'true');

        initDbConnection();
    }
}

log.info("DB size: " + sql.getValue("SELECT page_count * page_size / 1000 as size FROM pragma_page_count(), pragma_page_size()") + " KB");

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
