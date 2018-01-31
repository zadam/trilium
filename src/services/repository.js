const sql = require('./sql');
const protected_session = require('./protected_session');
const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const NoteTree = require('../entities/note_tree');
const Attribute = require('../entities/attribute');
const sync_table = require('../services/sync_table');

class Repository {
    constructor(dataKey) {
        this.dataKey = protected_session.getDataKey(dataKey);
    }

    async getEntities(query, params = []) {
        const rows = await sql.getRows(query, params);

        for (const row of rows) {
            row.dataKey = this.dataKey;
        }

        return rows.map(row => this.createEntityFromRow(row));
    }

    async getEntity(query, params = []) {
        const row = await sql.getRowOrNull(query, params);

        if (!row) {
            return null;
        }

        row.dataKey = this.dataKey;

        return this.createEntityFromRow(row);
    }

    async getNote(noteId) {
        return await this.getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
    }

    createEntityFromRow(row) {
        let entity;

        if (row.attributeId) {
            entity = new Attribute(this, row);
        }
        else if (row.noteRevisionId) {
            entity = new NoteRevision(this, row);
        }
        else if (row.noteTreeId) {
            entity = new NoteTree(this, row);
        }
        else if (row.noteId) {
            entity = new Note(this, row);
        }
        else {
            throw new Error('Unknown entity type for row: ' + JSON.stringify(row));
        }

        return entity;
    }

    async updateEntity(entity) {
        if (entity.beforeSaving) {
            entity.beforeSaving();
        }

        const clone = {...entity};

        delete clone.dataKey;
        delete clone.jsonContent;
        delete clone.repository;

        await sql.replace(entity.constructor.tableName, entity);

        const primaryKey = entity[entity.constructor.primaryKeyName];

        await sync_table.addEntitySync(entity.constructor.tableName, primaryKey);
    }
}

module.exports = Repository;