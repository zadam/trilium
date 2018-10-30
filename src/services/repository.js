"use strict";

const sql = require('./sql');
const syncTableService = require('../services/sync_table');
const eventService = require('./events');

let entityConstructor;

async function setEntityConstructor(constructor) {
    entityConstructor = constructor;
}

async function getEntityFromName(entityName, entityId) {
    if (!entityName || !entityId) {
        return null;
    }

    const constructor = entityConstructor.getEntityFromEntityName(entityName);

    return await getEntity(`SELECT * FROM ${constructor.entityName} WHERE ${constructor.primaryKeyName} = ?`, [entityId]);
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

/** @returns {Note|null} */
async function getNote(noteId) {
    return await getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
}

/** @returns {Branch|null} */
async function getBranch(branchId) {
    return await getEntity("SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

/** @returns {Image|null} */
async function getImage(imageId) {
    return await getEntity("SELECT * FROM images WHERE imageId = ?", [imageId]);
}

/** @returns {Attribute|null} */
async function getAttribute(attributeId) {
    return await getEntity("SELECT * FROM attributes WHERE attributeId = ?", [attributeId]);
}

/** @returns {Option|null} */
async function getOption(name) {
    return await getEntity("SELECT * FROM options WHERE name = ?", [name]);
}

async function updateEntity(entity) {
    const entityName = entity.constructor.entityName;
    const primaryKeyName = entity.constructor.primaryKeyName;

    const isNewEntity = !entity[primaryKeyName];

    if (entity.beforeSaving) {
        await entity.beforeSaving();
    }

    const clone = Object.assign({}, entity);

    // transient properties not supposed to be persisted
    delete clone.jsonContent;
    delete clone.isOwned;
    delete clone.isChanged;
    delete clone.origParentNoteId;
    delete clone.isContentAvailable;
    delete clone.__attributeCache;

    for (const key in clone) {
        // !isBuffer is for images and attachments
        if (clone[key] !== null && typeof clone[key] === 'object' && !Buffer.isBuffer(clone[key])) {
            clone[key] = JSON.stringify(clone[key]);
        }
    }

    await sql.transactional(async () => {
        await sql.replace(entityName, clone);

        const primaryKey = entity[primaryKeyName];

        if (entity.isChanged && (entityName !== 'options' || entity.isSynced)) {
            await syncTableService.addEntitySync(entityName, primaryKey);

            if (isNewEntity) {
                await eventService.emit(eventService.ENTITY_CREATED, {
                    entityName,
                    entity
                });
            }

            // it seems to be better to handle deletion with a separate event
            if (!entity.isDeleted) {
                await eventService.emit(eventService.ENTITY_CHANGED, {
                    entityName,
                    entity
                });
            }
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