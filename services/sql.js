"use strict";

const db = require('sqlite');
const utils = require('./utils');
const log = require('./log');

async function insert(table_name, rec, replace = false) {
    const keys = Object.keys(rec);
    if (keys.length === 0) {
        log.error("Can't insert empty object into table " + table_name);
        return;
    }

    const columns = keys.join(", ");
    const questionMarks = keys.map(p => "?").join(", ");

    const query = "INSERT " + (replace ? "OR REPLACE" : "") + " INTO " + table_name + "(" + columns + ") VALUES (" + questionMarks + ")";

    const res = await execute(query, Object.values(rec));

    return res.lastID;
}

async function beginTransaction() {
    return await db.run("BEGIN");
}

async function commit() {
    return await db.run("COMMIT");
}

async function rollback() {
    return await db.run("ROLLBACK");
}

async function getOption(optName) {
    const row = await getSingleResult("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);

    return row['opt_value'];
}

async function setOption(optName, optValue) {
    await execute("UPDATE options SET opt_value = ? WHERE opt_name = ?", [optValue, optName]);
}

async function getSingleResult(query, params = []) {
    return await db.get(query, ...params);
}

async function getResults(query, params = []) {
    return await db.all(query, ...params);
}

async function getFlattenedResults(key, query, params = []) {
    const list = [];
    const result = await getResults(query, params);

    for (const row of result) {
        list.push(row[key]);
    }

    return list;
}

async function execute(query, params = []) {
    return await db.run(query, ...params);
}

async function executeScript(query) {
    return await db.exec(query);
}

async function remove(tableName, noteId) {
    return await execute("DELETE FROM " + tableName + " WHERE note_id = ?", [noteId]);
}

async function addAudit(category, req=null, noteId=null, changeFrom=null, changeTo=null, comment=null) {
    const now = utils.nowTimestamp();

    const browserId = req == null ? null : req.get('x-browser-id');

    log.info("audit: " + category + ", browserId=" + browserId + ", noteId=" + noteId + ", from=" + changeFrom
        + ", to=" + changeTo + ", comment=" + comment);

    await execute("INSERT INTO audit_log (date_modified, category, browser_id, note_id, change_from, change_to, comment)"
           + " VALUES (?, ?, ?, ?, ?, ?, ?)", [now, category, browserId, noteId, changeFrom, changeTo, comment]);
}

async function deleteRecentAudits(category, req, noteId) {
    const browserId = req.get('x-browser-id');

    const deleteCutoff = utils.nowTimestamp() - 10 * 60;

    await execute("DELETE FROM audit_log WHERE category = ? AND browser_id = ? AND note_id = ? AND date_modified > ?",
            [category, browserId, noteId, deleteCutoff])
}

module.exports = {
    insert,
    getSingleResult,
    getResults,
    getFlattenedResults,
    execute,
    executeScript,
    getOption,
    setOption,
    beginTransaction,
    commit,
    rollback,
    addAudit,
    deleteRecentAudits,
    remove
};