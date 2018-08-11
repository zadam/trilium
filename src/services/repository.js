"use strict";

const sql = require('./sql');
const syncTableService = require('../services/sync_table');

let entityConstructor;

async function setEntityConstructor(constructor) {
    entityConstructor = constructor;
}

async function getEntityFromName(entityName, entityId) {
    const constructor = entityConstructor.getEntityFromTableName(entityName);

    return await getEntity(`SELECT * FROM ${constructor.tableName} WHERE ${constructor.primaryKeyName} = ?`, [entityId]);
}

async function getEntities(query, params = []) {
    const rows = await sql.getRows(query, params);

    return rows.map(entityConstructor.createEntityFromRow);
}

async function getEntity(query, params = []) {
    const row = await sql.getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return entityConstructor.createEntityFromRow(row);
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

async function getAttribute(attributeId) {
    return await getEntity("SELECT * FROM attributes WHERE attributeId = ?", [attributeId]);
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
    delete clone.isOwned;

    for (const key in clone) {
        // !isBuffer is for images and attachments
        if (clone[key] !== null && typeof clone[key] === 'object' && !Buffer.isBuffer(clone[key])) {
            clone[key] = JSON.stringify(clone[key]);
        }
    }

    await sql.transactional(async () => {
        await sql.replace(entity.constructor.tableName, clone);

        const primaryKey = entity[entity.constructor.primaryKeyName];

        if (entity.constructor.tableName !== 'options' || entity.isSynced) {
            await syncTableService.addEntitySync(entity.constructor.tableName, primaryKey);
        }
    });
}

module.exports = {
    getEntityFromName,
    getEntities,
    getEntity,
    getNote,
    getBranch,
    getImage,
    getAttribute,
    getOption,
    updateEntity,
    setEntityConstructor
};