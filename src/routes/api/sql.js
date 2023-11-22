"use strict";

const sql = require('../../services/sql.js');
const becca = require('../../becca/becca.js');

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
    const note = becca.getNoteOrThrow(req.params.noteId);

    const queries = note.getContent().split("\n---");

    try {
        const results = [];

        for (let query of queries) {
            query = query.trim();

            while (query.startsWith('-- ')) {
                // Query starts with one or more SQL comments, discard these before we execute.
                const pivot = query.indexOf('\n');
                query = pivot > 0 ? query.substr(pivot + 1).trim() : "";
            }
            
            if (!query) {
                continue;
            }

            if (query.toLowerCase().startsWith('select') || query.toLowerCase().startsWith('with')) {
                results.push(sql.getRows(query));
            }
            else {
                results.push(sql.execute(query));
            }
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
