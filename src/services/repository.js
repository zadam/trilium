"use strict";

const sql = require('./sql');
const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');
const Label = require('../entities/label');
const sync_table = require('../services/sync_table');

async function getEntities(query, params = []) {
    const rows = await sql.getRows(query, params);

    return rows.map(row => this.createEntityFromRow(row));
}

async function getEntity(query, params = []) {
    const row = await sql.getRowOrNull(query, params);

    if (!row) {
        return null;
    }

    return this.createEntityFromRow(row);
}

async function getNote(noteId) {
    return await this.getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
}

function createEntityFromRow(row) {
    let entity;

    if (row.labelId) {
        entity = new Label(row);
    }
    else if (row.noteRevisionId) {
        entity = new NoteRevision(row);
    }
    else if (row.branchId) {
        entity = new Branch(row);
    }
    else if (row.noteId) {
        entity = new Note(row);
    }
    else {
        throw new Error('Unknown entity type for row: ' + JSON.stringify(row));
    }

    return entity;
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
    updateEntity
};