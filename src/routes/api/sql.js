"use strict";

const sql = require('../../services/sql');

function getSchema() {
    const tableNames = sql.getColumn(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
    const tables = [];

    for (const tableName of tableNames) {
        tables.push({
            name: tableName,
            columns: sql.getRows(`PRAGMA table_info(${tableName})`)
        });
    }

    return tables;
}

function execute(req) {
    const queries = req.body.query.split("\n---");

    try {
        const results = [];

        for (const query of queries) {
            if (!query.trim()) {
                continue;
            }

            results.push(sql.getRows(query));
        }

        return {
            success: true,
            results
        };
    }
    catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

module.exports = {
    getSchema,
    execute
};
