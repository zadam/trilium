"use strict";

const log = require('../services/log');
const Database = require('better-sqlite3');
const dataDir = require('../services/data_dir');

const dbConnection = new Database(dataDir.DOCUMENT_PATH, { readonly: true });

[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `SIGTERM`].forEach(eventType => {
    process.on(eventType, () => {
        if (dbConnection) {
            // closing connection is especially important to fold -wal file into the main DB file
            // (see https://sqlite.org/tempfiles.html for details)
            dbConnection.close();
        }
    });
});

const statementCache = {};

function stmt(sql) {
    if (!(sql in statementCache)) {
        statementCache[sql] = dbConnection.prepare(sql);
    }

    return statementCache[sql];
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

// smaller values can result in better performance due to better usage of statement cache
const PARAM_LIMIT = 100;

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

        const statement = curParams.length === PARAM_LIMIT
            ? stmt(curQuery)
            : dbConnection.prepare(curQuery);

        const subResults = statement.all(curParamsObj);
        results = results.concat(subResults);
    }

    return results;
}

function getRows(query, params = []) {
    return wrap(query, s => s.all(params));
}

function getRawRows(query, params = []) {
    return wrap(query, s => s.raw().all(params));
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

function wrap(query, func) {
    const startTimestamp = Date.now();
    let result;

    try {
        result = func(stmt(query));
    }
    catch (e) {
        if (e.message.includes("The database connection is not open")) {
            // this often happens on killing the app which puts these alerts in front of user
            // in these cases error should be simply ignored.
            console.log(e.message);

            return null
        }

        throw e;
    }

    const milliseconds = Date.now() - startTimestamp;

    if (milliseconds >= 20) {
        if (query.includes("WITH RECURSIVE")) {
            log.info(`Slow recursive query took ${milliseconds}ms.`);
        }
        else {
            log.info(`Slow query took ${milliseconds}ms: ${query.trim().replace(/\s+/g, " ")}`);
        }
    }

    return result;
}

module.exports = {
    dbConnection,
    getValue,
    getRow,
    getRowOrNull,
    getRows,
    getRawRows,
    iterateRows,
    getManyRows,
    getMap,
    getColumn
};
