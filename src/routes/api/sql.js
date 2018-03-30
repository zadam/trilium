"use strict";

const sql = require('../../services/sql');

async function execute(req) {
    const query = req.body.query;

    try {
        return {
            success: true,
            rows: await sql.getRows(query)
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
    execute
};