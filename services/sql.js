"use strict";

const log = require('./log');
const dataDir = require('./data_dir');
const sqlite = require('sqlite');

async function createConnection() {
    return await sqlite.open(dataDir.DOCUMENT_PATH, {Promise});
}

const dbReady = createConnection();

async function insert(db, table_name, rec, replace = false) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't insert empty object into table " + table_name);
        return;
    }

    const columns = keys.join(", ");
    const questionMarks = keys.map(p => "?").join(", ");

    const query = "INSERT " + (replace ? "OR REPLACE" : "") + " INTO " + table_name + "(" + columns + ") VALUES (" + questionMarks + ")";

    const res = await execute(db, query, Object.values(rec));

    return res.lastID;
}

async function replace(db, table_name, rec) {
    return await insert(db, table_name, rec, true);
}

async function beginTransaction(db) {
    return await wrap(async () => db.run("BEGIN"));
}

async function commit(db) {
    return await wrap(async () => db.run("COMMIT"));
}

async function rollback(db) {
    return await wrap(async () => db.run("ROLLBACK"));
}

async function getSingleResult(query, params = []) {
    const db = await dbReady;

    return await wrap(async () => db.get(query, ...params));
}

async function getSingleResultOrNull(query, params = []) {
    const db = await dbReady;
    const all = await wrap(async () => db.all(query, ...params));

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

    return await wrap(async () => db.all(query, ...params));
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

async function execute(db, query, params = []) {
    return await wrap(async () => db.run(query, ...params));
}

async function executeScript(db, query) {
    return await wrap(async () => db.exec(query));
}

async function remove(db, tableName, noteId) {
    return await execute(db, "DELETE FROM " + tableName + " WHERE note_id = ?", [noteId]);
}

async function wrap(func) {
    const thisError = new Error();

    try {
        return await func();
    }
    catch (e) {
        log.error("Error executing query. Inner exception: " + e.stack + thisError.stack);

        throw thisError;
    }
}

async function doInTransaction(func) {
    const error = new Error(); // to capture correct stack trace in case of exception
    const db = await createConnection();

    try {

        await beginTransaction(db);

        await func(db);

        await commit(db);
    }
    catch (e) {
        log.error("Error executing transaction, executing rollback. Inner exception: " + e.stack + error.stack);

        await rollback(db);

        throw e;
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