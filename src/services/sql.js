"use strict";

const log = require('./log');
const cls = require('./cls');

let dbConnection;

function setDbConnection(connection) {
    dbConnection = connection;
}

async function insert(tableName, rec, replace = false) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't insert empty object into table " + tableName);
        return;
    }

    const columns = keys.join(", ");
    const questionMarks = keys.map(p => "?").join(", ");

    const query = "INSERT " + (replace ? "OR REPLACE" : "") + " INTO " + tableName + "(" + columns + ") VALUES (" + questionMarks + ")";

    const res = await execute(query, Object.values(rec));

    return res.lastID;
}

async function replace(tableName, rec) {
    return await insert(tableName, rec, true);
}

async function upsert(tableName, primaryKey, rec) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't upsert empty object into table " + tableName);
        return;
    }

    const columns = keys.join(", ");

    let i = 0;

    const questionMarks = keys.map(p => ":" + i++).join(", ");

    i = 0;

    const updateMarks = keys.map(key => `${key} = :${i++}`).join(", ");

    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${questionMarks}) 
                   ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateMarks}`;

    await execute(query, Object.values(rec));
}

async function beginTransaction() {
    return await execute("BEGIN");
}

async function commit() {
    return await execute("COMMIT");
}

async function rollback() {
    return await execute("ROLLBACK");
}

async function getRow(query, params = []) {
    return await wrap(async db => db.get(query, ...params));
}

async function getRowOrNull(query, params = []) {
    const all = await getRows(query, params);

    return all.length > 0 ? all[0] : null;
}

async function getValue(query, params = []) {
    const row = await getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return row[Object.keys(row)[0]];
}

const PARAM_LIMIT = 900; // actual limit is 999

// this is to overcome 999 limit of number of query parameters
async function getManyRows(query, params) {
    let results = [];

    while (params.length > 0) {
        const curParams = params.slice(0, Math.min(params.length, PARAM_LIMIT));
        params = params.slice(curParams.length);

        let i = 1;
        const questionMarks = curParams.map(() => "?" + i++).join(",");
        const curQuery = query.replace(/\?\?\?/g, questionMarks);

        results = results.concat(await getRows(curQuery, curParams));
    }

    return results;
}

async function getRows(query, params = []) {
    return await wrap(async db => db.all(query, ...params));
}

async function getMap(query, params = []) {
    const map = {};
    const results = await getRows(query, params);

    for (const row of results) {
        const keys = Object.keys(row);

        map[row[keys[0]]] = row[keys[1]];
    }

    return map;
}

async function getColumn(query, params = []) {
    const list = [];
    const result = await getRows(query, params);

    if (result.length === 0) {
        return list;
    }

    const key = Object.keys(result[0])[0];

    for (const row of result) {
        list.push(row[key]);
    }

    return list;
}

async function execute(query, params = []) {
    const startTimestamp = Date.now();

    const result = await wrap(async db => db.run(query, ...params));

    const milliseconds = Date.now() - startTimestamp;
    if (milliseconds >= 200) {
        log.info(`Slow query took ${milliseconds}ms: ${query}`);
    }

    return result;
}

async function executeScript(query) {
    return await wrap(async db => db.exec(query));
}

async function wrap(func) {
    const thisError = new Error();

    try {
        return await func(dbConnection);
    }
    catch (e) {
        log.error("Error executing query. Inner exception: " + e.stack + thisError.stack);

        thisError.message = e.stack;

        throw thisError;
    }
}

let transactionActive = false;
let transactionPromise = null;

async function transactional(func) {
    if (cls.namespace.get('isInTransaction')) {
        return await func();
    }

    while (transactionActive) {
        await transactionPromise;
    }

    let ret = null;
    const thisError = new Error(); // to capture correct stack trace in case of exception

    transactionActive = true;
    transactionPromise = new Promise(async (resolve, reject) => {
        try {
            await beginTransaction();

            cls.namespace.set('isInTransaction', true);

            ret = await func();

            await commit();

            transactionActive = false;
            resolve();
        }
        catch (e) {
            if (transactionActive) {
                log.error("Error executing transaction, executing rollback. Inner stack: " + e.stack + "\nOutside stack: " + thisError.stack);

                await rollback();

                transactionActive = false;
            }

            reject(e);
        }
        finally {
            cls.namespace.set('isInTransaction', false);
        }
    });

    if (transactionActive) {
        await transactionPromise;
    }

    return ret;
}

module.exports = {
    setDbConnection,
    insert,
    replace,
    getValue,
    getRow,
    getRowOrNull,
    getRows,
    getManyRows,
    getMap,
    getColumn,
    execute,
    executeScript,
    transactional,
    upsert
};