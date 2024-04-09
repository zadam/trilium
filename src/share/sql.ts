"use strict";

import Database = require('better-sqlite3');
import dataDir = require('../services/data_dir');

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

function getRawRows<T>(query: string, params = []): T[] {
    return dbConnection.prepare(query).raw().all(params) as T[];
}

function getRow<T>(query: string, params: string[] = []): T {
    return dbConnection.prepare(query).get(params) as T;
}

function getColumn<T>(query: string, params: string[] = []): T[] {
    return dbConnection.prepare(query).pluck().all(params) as T[];
}

export = {
    getRawRows,
    getRow,
    getColumn
};
