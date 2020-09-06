const log = require('./log');
const fs = require('fs');
const resourceDir = require('./resource_dir');
const sql = require('./sql');
const utils = require('./utils');
const optionService = require('./options');
const port = require('./port');
const Option = require('../entities/option');
const TaskContext = require('./task_context.js');
const migrationService = require('./migration');
const cls = require('./cls');

const dbReady = utils.deferred();

cls.init(initDbConnection);

function schemaExists() {
    return !!sql.getValue(`SELECT name FROM sqlite_master
                                 WHERE type = 'table' AND name = 'options'`);
}

function isDbInitialized() {
    if (!schemaExists()) {
        return false;
    }

    const initialized = sql.getValue("SELECT value FROM options WHERE name = 'initialized'");

    return initialized === 'true';
}

async function initDbConnection() {
    if (!isDbInitialized()) {
        log.info(`DB not initialized, please visit setup page` + (utils.isElectron() ? '' : ` - http://[your-server-host]:${await port} to see instructions on how to initialize Trilium.`));

        return;
    }

    await migrationService.migrateIfNecessary();

    require('./options_init').initStartupOptions();

    dbReady.resolve();
}

async function createInitialDatabase(username, password, theme) {
    log.info("Creating initial database ...");

    if (isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(resourceDir.DB_INIT_DIR + '/schema.sql', 'UTF-8');
    const demoFile = fs.readFileSync(resourceDir.DB_INIT_DIR + '/demo.zip');

    let rootNote;

    sql.transactional(() => {
        sql.executeScript(schema);

        const Note = require("../entities/note");
        const Branch = require("../entities/branch");

        rootNote = new Note({
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
    });

    const dummyTaskContext = new TaskContext("initial-demo-import", 'import', false);

    const zipImportService = require("./import/zip");
    await zipImportService.importZip(dummyTaskContext, demoFile, rootNote);

    sql.transactional(() => {
        const startNoteId = sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");

        const optionsInitService = require('./options_init');

        optionsInitService.initDocumentOptions();
        optionsInitService.initSyncedOptions(username, password);
        optionsInitService.initNotSyncedOptions(true, startNoteId, { theme });
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

function setDbAsInitialized() {
    if (!isDbInitialized()) {
        optionService.setOption('initialized', 'true');

        initDbConnection();
    }
}

dbReady.then(() => {
    setInterval(() => require('./backup').regularBackup(), 4 * 60 * 60 * 1000);

    // kickoff first backup soon after start up
    setTimeout(() => require('./backup').regularBackup(), 5 * 60 * 1000);
});

log.info("DB size: " + sql.getValue("SELECT page_count * page_size / 1000 as size FROM pragma_page_count(), pragma_page_size()") + " KB");

module.exports = {
    dbReady,
    schemaExists,
    isDbInitialized,
    initDbConnection,
    createInitialDatabase,
    createDatabaseForSync,
    setDbAsInitialized
};
