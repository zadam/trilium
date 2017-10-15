const db = require('sqlite');
const utils = require('./utils');

async function insert(table_name, rec) {
    const columns = Object.keys(rec).join(", ");
    const questionMarks = Object.keys(rec).map(p => "?").join(", ");

    const res = await execute("INSERT INTO " + table_name + "(" + columns + ") VALUES (" + questionMarks + ")", Object.values(rec));

    return res.lastID;
}

async function beginTransaction() {
    return await db.run("BEGIN");
}

async function commit() {
    return await db.run("COMMIT");
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

async function execute(query, params = []) {
    return await db.run(query, ...params);
}

async function remove(tableName, noteId) {
    return await execute("DELETE FROM " + tableName + " WHERE note_id = ?", [noteId]);
}

async function addAudit(category, req=null, noteId=null, changeFrom=null, changeTo=null, comment=null) {
    const now = utils.nowTimestamp();

    const browserId = req == null ? null : req.get('x-browser-id');

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
    execute,
    getOption,
    setOption,
    beginTransaction,
    commit,
    addAudit,
    deleteRecentAudits,
    remove
};