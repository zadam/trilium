"use strict";

const sql = require('./sql');
const syncTableService = require('../services/sync_table');

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

async function getBranch(branchId) {
    return await getEntity("SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

async function getImage(imageId) {
    return await getEntity("SELECT * FROM images WHERE imageId = ?", [imageId]);
}

async function getLabel(labelId) {
    return await getEntity("SELECT * FROM labels WHERE labelId = ?", [labelId]);
}

async function getOption(name) {
    return await getEntity("SELECT * FROM options WHERE name = ?", [name]);
}

async function updateEntity(entity) {
    if (entity.beforeSaving) {
        await entity.beforeSaving();
    }

    const clone = Object.assign({}, entity);

    delete clone.jsonContent;

    await sql.transactional(async () => {
        await sql.replace(entity.constructor.tableName, clone);

        const primaryKey = entity[entity.constructor.primaryKeyName];

        await syncTableService.addEntitySync(entity.constructor.tableName, primaryKey);
    });
}

module.exports = {
    getEntities,
    getEntity,
    getNote,
    getBranch,
    getImage,
    getLabel,
    getOption,
    updateEntity,
    setEntityConstructor
};