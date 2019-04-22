"use strict";

const sql = require('./sql');
const syncTableService = require('../services/sync_table');
const eventService = require('./events');
const cls = require('./cls');

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

/** @returns {Promise<Note|null>} */
async function getNote(noteId) {
    return await getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
}

/** @returns {Promise<Note[]>} */
async function getNotes(noteIds) {
    // this note might be optimised, but remember that it must keep the existing order of noteIds
    // (important e.g. for @orderBy in search)
    const notes = [];

    for (const noteId of noteIds) {
        const note = await getNote(noteId);

        notes.push(note);
    }

    return notes;
}

/** @returns {Promise<Branch|null>} */
async function getBranch(branchId) {
    return await getEntity("SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

/** @returns {Promise<Attribute|null>} */
async function getAttribute(attributeId) {
    return await getEntity("SELECT * FROM attributes WHERE attributeId = ?", [attributeId]);
}

/** @returns {Promise<Option|null>} */
async function getOption(name) {
    return await getEntity("SELECT * FROM options WHERE name = ?", [name]);
}

/** @returns {Promise<Link|null>} */
async function getLink(linkId) {
    return await getEntity("SELECT * FROM links WHERE linkId = ?", [linkId]);
}

async function updateEntity(entity) {
    const entityName = entity.constructor.entityName;
    const primaryKeyName = entity.constructor.primaryKeyName;

    const isNewEntity = !entity[primaryKeyName];

    if (entity.beforeSaving) {
        await entity.beforeSaving();
    }

    const clone = Object.assign({}, entity);

    // this check requires that updatePojo is not static
    if (entity.updatePojo) {
        await entity.updatePojo(clone);
    }

    // indicates whether entity actually changed
    delete clone.isChanged;

    for (const key in clone) {
        // !isBuffer is for images and attachments
        if (clone[key] !== null && typeof clone[key] === 'object' && !Buffer.isBuffer(clone[key])) {
            clone[key] = JSON.stringify(clone[key]);
        }
    }

    await sql.transactional(async () => {
        await sql.upsert(entityName, primaryKeyName, clone);

        const primaryKey = entity[primaryKeyName];

        if (entity.isChanged) {
            if (entityName !== 'options' || entity.isSynced) {
                await syncTableService.addEntitySync(entityName, primaryKey);
            }

            if (!cls.isEntityEventsDisabled()) {
                const eventPayload = {
                    entityName,
                    entity
                };

                if (isNewEntity && !entity.isDeleted) {
                    await eventService.emit(eventService.ENTITY_CREATED, eventPayload);
                }

                // it seems to be better to handle deletion and update separately
                await eventService.emit(entity.isDeleted ? eventService.ENTITY_DELETED : eventService.ENTITY_CHANGED, eventPayload);
            }
        }

        if (entity.afterSaving) {
            await entity.afterSaving();
        }
    });
}

module.exports = {
    getEntityFromName,
    getEntities,
    getEntity,
    getNote,
    getNotes,
    getBranch,
    getAttribute,
    getOption,
    getLink,
    updateEntity,
    setEntityConstructor
};