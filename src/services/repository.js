"use strict";

const sql = require('./sql');
const sync_table = require('../services/sync_table');

let entityConstructor;

async function setEntityConstructor(constructor) {
    entityConstructor = constructor;
}

async function getEntities(query, params = []) {
    const rows = await sql.getRows(query, params);

    return rows.map(entityConstructor);
}

async function getEntity(query, params = []) {
    const row = await sql.getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return entityConstructor(row);
}

async function getNote(noteId) {
    return await getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
}

async function updateEntity(entity) {
    if (entity.beforeSaving) {
        entity.beforeSaving();
    }

    const clone = Object.assign({}, entity);

    delete clone.jsonContent;

    await sql.replace(entity.constructor.tableName, clone);

    const primaryKey = entity[entity.constructor.primaryKeyName];

    await sync_table.addEntitySync(entity.constructor.tableName, primaryKey);
}

module.exports = {
    getEntities,
    getEntity,
    getNote,
    updateEntity,
    setEntityConstructor
};