"use strict";

const log = require('./log');
const dataDir = require('./data_dir');
const fs = require('fs');
const sqlite = require('sqlite');
const utils = require('./utils');
const app_info = require('./app_info');

async function createConnection() {
    return await sqlite.open(dataDir.DOCUMENT_PATH, {Promise});
}

const dbConnected = createConnection();

let dbReadyResolve = null;
const dbReady = new Promise((resolve, reject) => {
    dbConnected.then(async db => {
        dbReadyResolve = () => {
            log.info("DB ready.");

            resolve(db);
        };

        const tableResults = await getResults("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'");
        if (tableResults.length !== 1) {
            log.info("Connected to db, but schema doesn't exist. Initializing schema ...");

            const schema = fs.readFileSync('schema.sql', 'UTF-8');

            await doInTransaction(async () => {
                await executeScript(schema);

                const noteId = utils.newNoteId();
                const now = utils.nowDate();

                await insert('notes_tree', {
                    note_tree_id: utils.newNoteTreeId(),
                    note_id: noteId,
                    note_pid: 'root',
                    note_pos: 1,
                    is_deleted: 0,
                    date_modified: now
                });

                await insert('notes', {
                    note_id: noteId,
                    note_title: 'Welcome to Trilium!',
                    note_text: 'Text',
                    is_protected: 0,
                    is_deleted: 0,
                    date_created: now,
                    date_modified: now
                });

                await require('./options').initOptions(noteId);
            });

            // we don't resolve dbReady promise because user needs to setup the username and password to initialize
            // the database
        }
        else {
            const username = await getSingleValue("SELECT opt_value FROM options WHERE opt_name = 'username'");

            if (!username) {
                log.info("Login/password not initialized. DB not ready.");

                return;
            }

            if (!await isDbUpToDate()) {
                return;
            }

            resolve(db);
        }
    })
    .catch(e => {
        console.log("Error connecting to DB.", e);
        process.exit(1);
    });
});

function setDbReadyAsResolved() {
    dbReadyResolve();
}

async function insert(table_name, rec, replace = false) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't insert empty object into table " + table_name);
        return;
    }

    const columns = keys.join(", ");
    const questionMarks = keys.map(p => "?").join(", ");

    const query = "INSERT " + (replace ? "OR REPLACE" : "") + " INTO " + table_name + "(" + columns + ") VALUES (" + questionMarks + ")";

    const res = await execute(query, Object.values(rec));

    return res.lastID;
}

async function replace(table_name, rec) {
    return await insert(table_name, rec, true);
}

async function beginTransaction() {
    return await wrap(async db => db.run("BEGIN"));
}

async function commit() {
    return await wrap(async db => db.run("COMMIT"));
}

async function rollback() {
    return await wrap(async db => db.run("ROLLBACK"));
}

async function getSingleResult(query, params = []) {
    return await wrap(async db => db.get(query, ...params));
}

async function getSingleResultOrNull(query, params = []) {
    const all = await wrap(async db => db.all(query, ...params));

    return all.length > 0 ? all[0] : null;
}

async function getSingleValue(query, params = []) {
    const row = await getSingleResultOrNull(query, params);

    if (!row) {
        return null;
    }

    return row[Object.keys(row)[0]];
}

async function getResults(query, params = []) {
    return await wrap(async db => db.all(query, ...params));
}

async function getMap(query, params = []) {
    const map = {};
    const results = await getResults(query, params);

    for (const row of results) {
        const keys = Object.keys(row);

        map[row[keys[0]]] = row[keys[1]];
    }

    return map;
}

async function getFlattenedResults(key, query, params = []) {
    const list = [];
    const result = await getResults(query, params);

    for (const row of result) {
        list.push(row[key]);
    }

    return list;
}

async function execute(query, params = []) {
    return await wrap(async db => db.run(query, ...params));
}

async function executeScript(query) {
    return await wrap(async db => db.exec(query));
}

async function wrap(func) {
    const thisError = new Error();
    const db = await dbConnected;

    try {
        return await func(db);
    }
    catch (e) {
        log.error("Error executing query. Inner exception: " + e.stack + thisError.stack);

        throw thisError;
    }
}

let transactionActive = false;
let transactionPromise = null;

async function doInTransaction(func) {
    while (transactionActive) {
        await transactionPromise;
    }

    const error = new Error(); // to capture correct stack trace in case of exception

    transactionActive = true;
    transactionPromise = new Promise(async (resolve, reject) => {
        try {
            await beginTransaction();

            await func();

            await commit();

            transactionActive = false;
            resolve();
        }
        catch (e) {
            log.error("Error executing transaction, executing rollback. Inner exception: " + e.stack + error.stack);

            await rollback();

            transactionActive = false;

            reject(e);
        }
    });

    if (transactionActive) {
        await transactionPromise;
    }
}

async function isDbUpToDate() {
    const dbVersion = parseInt(await getSingleValue("SELECT opt_value FROM options WHERE opt_name = 'db_version'"));

    const upToDate = dbVersion >= app_info.db_version;

    if (!upToDate) {
        log.info("App db version is " + app_info.db_version + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

module.exports = {
    dbReady,
    insert,
    replace,
    getSingleValue,
    getSingleResult,
    getSingleResultOrNull,
    getResults,
    getMap,
    getFlattenedResults,
    execute,
    executeScript,
    doInTransaction,
    setDbReadyAsResolved,
    isDbUpToDate
};