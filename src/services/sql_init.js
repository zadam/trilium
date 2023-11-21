import log from './log.js'
import fs from 'fs';
import resourceDir from './resource_dir.js'
import sql from './sql.js'
import utils from './utils.js'
import port from './port.js'
import TaskContext from './task_context.js'
import migrationService from './migration.js'
import cls from './cls.js'
import config from './config.js'
import importSync from "import-sync";

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
        log.info(`DB not initialized, please visit setup page` +
            (utils.isElectron() ? '' : ` - http://[your-server-host]:${port} to see instructions on how to initialize Trilium.`));

        return;
    }

    await migrationService.migrateIfNecessary();

    sql.execute('CREATE TEMP TABLE "param_list" (`paramId` TEXT NOT NULL PRIMARY KEY)');

    dbReady.resolve();
}

async function createInitialDatabase() {
    if (isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(`${resourceDir.DB_INIT_DIR}/schema.sql`, 'UTF-8');
    const demoFile = fs.readFileSync(`${resourceDir.DB_INIT_DIR}/demo.zip`);

    let rootNote;

    sql.transactional(() => {
        log.info("Creating database schema ...");

        sql.executeScript(schema);

        importSync("../becca/becca_loader.js").load();
        log.info("Creating root note ...");

        const BNote = importSync("../becca/entities/bnote.js");
        rootNote = new BNote({
            noteId: 'root',
            title: 'root',
            type: 'text',
            mime: 'text/html'
        }).save();

        rootNote.setContent('');

        const BBranch = importSync("../becca/entities/bbranch.js");
        new BBranch({
            noteId: 'root',
            parentNoteId: 'none',
            isExpanded: true,
            notePosition: 10
        }).save();

        const optionsInitService = importSync("./options_init.js");
        optionsInitService.initDocumentOptions();
        optionsInitService.initNotSyncedOptions(true, {});
        optionsInitService.initStartupOptions();
        importSync("./encryption/password.js").resetPassword();
    });

    log.info("Importing demo content ...");

    const dummyTaskContext = new TaskContext("no-progress-reporting", 'import', false);
    await importSync("./import/zip.js").importZip(dummyTaskContext, demoFile, rootNote);

    sql.transactional(() => {
        // this needs to happen after ZIP import,
        // the previous solution was to move option initialization here, but then the important parts of initialization
        // are not all in one transaction (because ZIP import is async and thus not transactional)

        const startNoteId = sql.getValue("SELECT noteId FROM branches WHERE parentNoteId = 'root' AND isDeleted = 0 ORDER BY notePosition");
        const optionService = importSync('./options.js');
        optionService.setOption('openNoteContexts', JSON.stringify([
            {
                notePath: startNoteId,
                active: true
            }
        ]));
    });

    log.info("Schema and initial content generated.");

    initDbConnection();
}

function createDatabaseForSync(options, syncServerHost = '', syncProxy = '') {
    log.info("Creating database for sync");

    if (isDbInitialized()) {
        throw new Error("DB is already initialized");
    }

    const schema = fs.readFileSync(`${resourceDir.DB_INIT_DIR}/schema.sql`, 'UTF-8');

    sql.transactional(() => {
        sql.executeScript(schema);

        const optionsInitService = importSync("./options_init.js");
        optionsInitService.initNotSyncedOptions(false,  { syncServerHost, syncProxy });

        const BOption = importSync('../becca/entities/boption.js');
        // document options required for sync to kick off
        for (const opt of options) {
            new BOption(opt).save();
        }
    });

    log.info("Schema and not synced options generated.");
}

function setDbAsInitialized() {
    if (!isDbInitialized()) {
        const optionService = importSync('./options.js');
        optionService.setOption('initialized', 'true');

        initDbConnection();
    }
}

function optimize() {
    log.info("Optimizing database");
    const start = Date.now();

    sql.execute("PRAGMA optimize");

    log.info(`Optimization finished in ${Date.now() - start}ms.`);
}

dbReady.then(() => {
    if (config.General && config.General.noBackup === true) {
        log.info("Disabling scheduled backups.");

        return;
    }

    setInterval(() => importSync("./backup.js").regularBackup(), 4 * 60 * 60 * 1000);

    // kickoff first backup soon after start-up
    setTimeout(() => importSync("./backup.js").regularBackup(), 5 * 60 * 1000);

    // optimize is usually inexpensive no-op, so running it semi-frequently is not a big deal
    setTimeout(() => optimize(), 60 * 60 * 1000);

    setInterval(() => optimize(), 10 * 60 * 60 * 1000);
});

function getDbSize() {
    return sql.getValue("SELECT page_count * page_size / 1000 as size FROM pragma_page_count(), pragma_page_size()");
}

log.info(`DB size: ${getDbSize()} KB`);

export default {
    dbReady,
    schemaExists,
    isDbInitialized,
    createInitialDatabase,
    createDatabaseForSync,
    setDbAsInitialized,
    getDbSize
};
