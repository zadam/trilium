"use strict";

const log = require('./log');
const dataDir = require('./data_dir');
const sqlite = require('sqlite');

async function createConnection() {
    return await sqlite.open(dataDir.DOCUMENT_PATH, {Promise});
}

const dbReady = createConnection();

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
    const db = await dbReady;

    return await wrap(async db => db.get(query, ...params));
}

async function getSingleResultOrNull(query, params = []) {
    const db = await dbReady;
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
    const db = await dbReady;

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

async function remove(tableName, noteId) {
    return await execute("DELETE FROM " + tableName + " WHERE note_id = ?", [noteId]);
}

async function wrap(func) {
    const thisError = new Error();
    const db = await dbReady;

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
            resolve();

            throw e;
        }
    });

    if (transactionActive) {
        await transactionPromise;
    }
}

dbReady
    .then(async () => {
        const tableResults = await getResults("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'");

        if (tableResults.length !== 1) {
            console.log("No connection to initialized DB.");
            process.exit(1);
        }
    })
    .catch(e => {
        console.log("Error connecting to DB.", e);
        process.exit(1);
    });

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
    remove,
    doInTransaction
};