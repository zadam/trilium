"use strict";

const db = require('sqlite');
const utils = require('./utils');
const log = require('./log');
const SOURCE_ID = require('./source_id');

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

async function replace(table_name, rec) {
    return await insert(table_name, rec, true);
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

async function getSingleResult(query, params = []) {
    return await wrap(async () => db.get(query, ...params));
}

async function getSingleResultOrNull(query, params = []) {
    const all = await wrap(async () => db.all(query, ...params));

    return all.length > 0 ? all[0] : null;
}

async function getSingleValue(query, params = []) {
    const row = await getSingleResultOrNull(query, params);

    if (!row) {
        return null;
    }

    return row[Object.keys(row)[0]];
}

async function getResults(query, params = []) {
    return await wrap(async () => db.all(query, ...params));
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
    return await wrap(async () => db.run(query, ...params));
}

async function executeScript(query) {
    return await wrap(async () => db.exec(query));
}

async function remove(tableName, noteId) {
    return await execute("DELETE FROM " + tableName + " WHERE note_id = ?", [noteId]);
}

async function addAudit(category, req=null, noteId=null, changeFrom=null, changeTo=null, comment=null) {
    const browserId = req == null ? null : req.get('x-browser-id');

    await addAuditWithBrowserId(category, browserId, noteId, changeFrom, changeTo, comment);
}

async function addSyncAudit(category, sourceId, noteId) {
    await addAuditWithBrowserId(category, sourceId, noteId);
}

async function addAuditWithBrowserId(category, browserId=null, noteId=null, changeFrom=null, changeTo=null, comment=null) {
    const now = utils.nowTimestamp();
    log.info("audit: " + category + ", browserId=" + browserId + ", noteId=" + noteId + ", from=" + changeFrom
        + ", to=" + changeTo + ", comment=" + comment);

    const id = utils.randomString(14);

    await execute("INSERT INTO audit_log (id, date_modified, category, browser_id, note_id, change_from, change_to, comment)"
        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, now, category, browserId, noteId, changeFrom, changeTo, comment]);
}

async function deleteRecentAudits(category, req, noteId) {
    const browserId = req.get('x-browser-id');

    const deleteCutoff = utils.nowTimestamp() - 10 * 60;

    await execute("DELETE FROM audit_log WHERE category = ? AND browser_id = ? AND note_id = ? AND date_modified > ?",
            [category, browserId, noteId, deleteCutoff])
}

async function addNoteSync(noteId, sourceId) {
    await addEntitySync("notes", noteId, sourceId)
}

async function addNoteTreeSync(noteId, sourceId) {
    await addEntitySync("notes_tree", noteId, sourceId)
}

async function addNoteHistorySync(noteHistoryId, sourceId) {
    await addEntitySync("notes_history", noteHistoryId, sourceId);
}

async function addOptionsSync(optName, sourceId) {
    await addEntitySync("options", optName, sourceId);
}

async function addEntitySync(entityName, entityId, sourceId) {
    await replace("sync", {
        entity_name: entityName,
        entity_id: entityId,
        sync_date: utils.nowTimestamp(),
        source_id: sourceId || SOURCE_ID
    });
}

async function wrap(func) {
    const error = new Error();

    try {
        return await func();
    }
    catch (e) {
        log.error("Error executing transaction, executing rollback. Inner exception: " + e.stack + error.stack);

        throw e;
    }
}

async function doInTransaction(func) {
    const error = new Error(); // to capture correct stack trace in case of exception

    try {

        await beginTransaction();

        await func();

        await commit();
    }
    catch (e) {
        log.error("Error executing transaction, executing rollback. Inner exception: " + e.stack + error.stack);

        await rollback();

        throw e;
    }
}

module.exports = {
    insert,
    replace,
    getSingleValue,
    getSingleResult,
    getSingleResultOrNull,
    getResults,
    getFlattenedResults,
    execute,
    executeScript,
    addAudit,
    addSyncAudit,
    deleteRecentAudits,
    remove,
    doInTransaction,
    addNoteSync,
    addNoteTreeSync,
    addNoteHistorySync,
    addOptionsSync
};