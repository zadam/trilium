"use strict";

const log = require('./log');
const cls = require('./cls');

let dbConnection;

function setDbConnection(connection) {
    dbConnection = connection;
}

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `SIGTERM`].forEach(eventType => {
    process.on(eventType, () => {
        if (dbConnection) {
            // closing connection is especially important to fold -wal file into the main DB file
            // (see https://sqlite.org/tempfiles.html for details)
            dbConnection.close();
        }
    });
});

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

    return res.lastInsertRowid;
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

    const questionMarks = keys.map(colName => "@" + colName).join(", ");

    const updateMarks = keys.map(colName => `${colName} = @${colName}`).join(", ");

    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${questionMarks}) 
                   ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateMarks}`;

    for (const idx in rec) {
        if (rec[idx] === true || rec[idx] === false) {
            rec[idx] = rec[idx] ? 1 : 0;
        }
    }

    await execute(query, rec);
}

const statementCache = {};

function stmt(sql) {
    if (!(sql in statementCache)) {
        statementCache[sql] = dbConnection.prepare(sql);
    }

    return statementCache[sql];
}

function beginTransaction() {
    return stmt("BEGIN").run();
}

function commit() {
    return stmt("COMMIT").run();
}

function rollback() {
    return stmt("ROLLBACK").run();
}

async function getRow(query, params = []) {
    return wrap(() => stmt(query).get(params), query);
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

        const curParamsObj = {};

        let j = 1;
        for (const param of curParams) {
            curParamsObj['param' + j++] = param;
        }

        let i = 1;
        const questionMarks = curParams.map(() => ":param" + i++).join(",");
        const curQuery = query.replace(/\?\?\?/g, questionMarks);

        results = results.concat(await getRows(curQuery, curParamsObj));
    }

    return results;
}

async function getRows(query, params = []) {
    return wrap(() => stmt(query).all(params), query);
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
    await startTransactionIfNecessary();

    return wrap(() => stmt(query).run(params), query);
}

async function executeWithoutTransaction(query, params = []) {
    await dbConnection.run(query, params);
}

async function executeMany(query, params) {
    await startTransactionIfNecessary();

    // essentially just alias
    await getManyRows(query, params);
}

async function executeScript(query) {
    await startTransactionIfNecessary();

    return wrap(() => stmt.run(query), query);
}

function wrap(func, query) {
    if (!dbConnection) {
        throw new Error("DB connection not initialized yet");
    }

    const thisError = new Error();

    try {
        const startTimestamp = Date.now();

        const result = func(dbConnection);

        const milliseconds = Date.now() - startTimestamp;
        if (milliseconds >= 300) {
            if (query.includes("WITH RECURSIVE")) {
                log.info(`Slow recursive query took ${milliseconds}ms.`);
            }
            else {
                log.info(`Slow query took ${milliseconds}ms: ${query}`);
            }
        }

        return result;
    }
    catch (e) {
        log.error("Error executing query. Inner exception: " + e.stack + thisError.stack);

        thisError.message = e.stack;

        throw thisError;
    }
}

// true if transaction is active globally.
// cls.namespace.get('isTransactional') OTOH indicates active transaction in active CLS
let transactionActive = false;
// resolves when current transaction ends with either COMMIT or ROLLBACK
let transactionPromise = null;
let transactionPromiseResolve = null;

async function startTransactionIfNecessary() {
    if (!cls.get('isTransactional')
        || cls.get('isInTransaction')) {
        return;
    }

    while (transactionActive) {
        await transactionPromise;
    }

    // first set semaphore (atomic operation and only then start transaction
    transactionActive = true;
    transactionPromise = new Promise(res => transactionPromiseResolve = res);
    cls.set('isInTransaction', true);

    await beginTransaction();
}

async function transactional(func) {
    // if the CLS is already transactional then the whole transaction is handled by higher level transactional() call
    if (cls.get('isTransactional')) {
        return await func();
    }

    cls.set('isTransactional', true); // this signals that transaction will be needed if there's a write operation

    try {
        const ret = await func();

        if (cls.get('isInTransaction')) {
            await commit();

            // note that sync rows sent from this action will be sent again by scheduled periodic ping
            require('./ws.js').sendPingToAllClients();
        }

        return ret;
    }
    catch (e) {
        if (cls.get('isInTransaction')) {
            await rollback();
        }

        throw e;
    }
    finally {
        cls.namespace.set('isTransactional', false);

        if (cls.namespace.get('isInTransaction')) {
            transactionActive = false;
            cls.namespace.set('isInTransaction', false);
            // resolving even for rollback since this is just semaphore for allowing another write transaction to proceed
            transactionPromiseResolve();
        }
    }
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
    executeWithoutTransaction,
    executeMany,
    executeScript,
    transactional,
    upsert
};
