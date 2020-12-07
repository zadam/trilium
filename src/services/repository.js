"use strict";

const sql = require('./sql');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events');
const cls = require('./cls');
const entityConstructor = require('../entities/entity_constructor');

function getEntityFromName(entityName, entityId) {
    if (!entityName || !entityId) {
        return null;
    }

    const constructor = entityConstructor.getEntityFromEntityName(entityName);

    return getEntity(`SELECT * FROM ${constructor.entityName} WHERE ${constructor.primaryKeyName} = ?`, [entityId]);
}

function getEntities(query, params = []) {
    const rows = sql.getRows(query, params);

    return rows.map(entityConstructor.createEntityFromRow);
}

function getEntity(query, params = []) {
    const row = sql.getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return entityConstructor.createEntityFromRow(row);
}

function getCachedEntity(entityName, entityId, query) {
    let entity = cls.getEntityFromCache(entityName, entityId);

    if (!entity) {
        entity = getEntity(query, [entityId]);

        cls.setEntityToCache(entityName, entityId, entity);
    }

    return entity;
}

/** @returns {Note|null} */
function getNote(noteId) {
    return getCachedEntity('notes', noteId, "SELECT * FROM notes WHERE noteId = ?");
}

/** @returns {Note[]} */
function getNotes(noteIds) {
    // this note might be optimised, but remember that it must keep the existing order of noteIds
    // (important e.g. for @orderBy in search)
    const notes = [];

    for (const noteId of noteIds) {
        const note = getNote(noteId);

        notes.push(note);
    }

    return notes;
}

/** @returns {NoteRevision|null} */
function getNoteRevision(noteRevisionId) {
    return getCachedEntity('note_revisions', noteRevisionId, "SELECT * FROM note_revisions WHERE noteRevisionId = ?");
}

/** @returns {Branch|null} */
function getBranch(branchId) {
    return getCachedEntity('branches', branchId, "SELECT * FROM branches WHERE branchId = ?", [branchId]);
}

/** @returns {Attribute|null} */
function getAttribute(attributeId) {
    return getCachedEntity('attributes', attributeId, "SELECT * FROM attributes WHERE attributeId = ?");
}

/** @returns {Option|null} */
function getOption(name) {
    return getEntity("SELECT * FROM options WHERE name = ?", [name]);
}

function updateEntity(entity) {
    const entityName = entity.constructor.entityName;
    const primaryKeyName = entity.constructor.primaryKeyName;

    const isNewEntity = !entity[primaryKeyName];

    if (entity.beforeSaving) {
        entity.beforeSaving();
    }

    const clone = Object.assign({}, entity);

    // this check requires that updatePojo is not static
    if (entity.updatePojo) {
        entity.updatePojo(clone);
    }

    for (const key in clone) {
        // !isBuffer is for images and attachments
        if (clone[key] !== null && typeof clone[key] === 'object' && !Buffer.isBuffer(clone[key])) {
            clone[key] = JSON.stringify(clone[key]);
        }
    }

    sql.transactional(() => {
        sql.upsert(entityName, primaryKeyName, clone);

        const primaryKey = entity[primaryKeyName];

        const isSynced = entityName !== 'options' || entity.isSynced;

        entityChangesService.addEntityChange(entityName, primaryKey, null, isSynced);

        if (!cls.isEntityEventsDisabled()) {
            const eventPayload = {
                entityName,
                entity
            };

            if (isNewEntity && !entity.isDeleted) {
                eventService.emit(eventService.ENTITY_CREATED, eventPayload);
            }

            eventService.emit(entity.isDeleted ? eventService.ENTITY_DELETED : eventService.ENTITY_CHANGED, eventPayload);
        }
    });
}

module.exports = {
    getEntityFromName,
    getEntities,
    getEntity,
    getNote,
    getNotes,
    getNoteRevision,
    getBranch,
    getAttribute,
    getOption,
    updateEntity
};
