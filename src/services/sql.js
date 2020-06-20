"use strict";

const log = require('./log');
const cls = require('./cls');
const Database = require('better-sqlite3');
const dataDir = require('./data_dir');

const dbConnection = new Database(dataDir.DOCUMENT_PATH);
dbConnection.pragma('journal_mode = WAL');

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `SIGTERM`].forEach(eventType => {
    process.on(eventType, () => {
        if (dbConnection) {
            // closing connection is especially important to fold -wal file into the main DB file
            // (see https://sqlite.org/tempfiles.html for details)
            dbConnection.close();
        }
    });
});

function insert(tableName, rec, replace = false) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't insert empty object into table " + tableName);
        return;
    }

    const columns = keys.join(", ");
    const questionMarks = keys.map(p => "?").join(", ");

    const query = "INSERT " + (replace ? "OR REPLACE" : "") + " INTO " + tableName + "(" + columns + ") VALUES (" + questionMarks + ")";

    const res = execute(query, Object.values(rec));

    return res.lastInsertRowid;
}

function replace(tableName, rec) {
    return insert(tableName, rec, true);
}

function upsert(tableName, primaryKey, rec) {
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

    execute(query, rec);
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

function getRow(query, params = []) {
    return wrap(query, s => s.get(params));
}

function getRowOrNull(query, params = []) {
    const all = getRows(query, params);

    return all.length > 0 ? all[0] : null;
}

function getValue(query, params = []) {
    const row = getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return row[Object.keys(row)[0]];
}

const PARAM_LIMIT = 900; // actual limit is 999

// this is to overcome 999 limit of number of query parameters
function getManyRows(query, params) {
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

        const subResults = dbConnection.prepare(curQuery).all(curParamsObj);
        results = results.concat(subResults);
    }

    return results;
}

function getRows(query, params = []) {
    return wrap(query, s => s.all(params));
}

function iterateRows(query, params = []) {
    return stmt(query).iterate(params);
}

function getMap(query, params = []) {
    const map = {};
    const results = getRows(query, params);

    for (const row of results) {
        const keys = Object.keys(row);

        map[row[keys[0]]] = row[keys[1]];
    }

    return map;
}

function getColumn(query, params = []) {
    const list = [];
    const result = getRows(query, params);

    if (result.length === 0) {
        return list;
    }

    const key = Object.keys(result[0])[0];

    for (const row of result) {
        list.push(row[key]);
    }

    return list;
}

function execute(query, params = []) {
    startTransactionIfNecessary();

    return wrap(query, s => s.run(params));
}

function executeWithoutTransaction(query, params = []) {
    dbConnection.run(query, params);
}

function executeMany(query, params) {
    startTransactionIfNecessary();

    getManyRows(query, params);
}

function executeScript(query) {
    startTransactionIfNecessary();

    return dbConnection.exec(query);
}

function wrap(query, func) {
    const startTimestamp = Date.now();

    const result = func(stmt(query));

    const milliseconds = Date.now() - startTimestamp;

    if (milliseconds >= 20) {
        if (query.includes("WITH RECURSIVE")) {
            log.info(`Slow recursive query took ${milliseconds}ms.`);
        }
        else {
            log.info(`Slow query took ${milliseconds}ms: ${query}`);
        }
    }

    return result;
}

function startTransactionIfNecessary() {
    if (!cls.get('isTransactional') || dbConnection.inTransaction) {
        return;
    }

    beginTransaction();
}

function transactional(func) {
    // if the CLS is already transactional then the whole transaction is handled by higher level transactional() call
    if (cls.get('isTransactional')) {
        return func();
    }

    cls.set('isTransactional', true); // this signals that transaction will be needed if there's a write operation

    try {
        const ret = func();

        if (dbConnection.inTransaction) {
            commit();

            // note that sync rows sent from this action will be sent again by scheduled periodic ping
            require('./ws.js').sendPingToAllClients();
        }

        return ret;
    }
    catch (e) {
        if (dbConnection.inTransaction) {
            rollback();
        }

        throw e;
    }
    finally {
        cls.namespace.set('isTransactional', false);
    }
}

module.exports = {
    dbConnection,
    insert,
    replace,
    getValue,
    getRow,
    getRowOrNull,
    getRows,
    iterateRows,
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
