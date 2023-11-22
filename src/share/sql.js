"use strict";

const Database = require('better-sqlite3');
const dataDir = require('../services/data_dir.js');

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

function getRawRows(query, params = []) {
    return dbConnection.prepare(query).raw().all(params);
}

function getRow(query, params = []) {
    return dbConnection.prepare(query).get(params);
}

function getColumn(query, params = []) {
    return dbConnection.prepare(query).pluck().all(params);
}

module.exports = {
    getRawRows,
    getRow,
    getColumn
};
