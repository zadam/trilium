const sql = require('./sql');
const protected_session = require('./protected_session');
const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');
const Label = require('../entities/label');
const sync_table = require('../services/sync_table');

class Repository {
    async getEntities(query, params = []) {
        const rows = await sql.getRows(query, params);

        return rows.map(row => this.createEntityFromRow(row));
    }

    async getEntity(query, params = []) {
        const row = await sql.getRowOrNull(query, params);

        if (!row) {
            return null;
        }

        return this.createEntityFromRow(row);
    }

    async getNote(noteId) {
        return await this.getEntity("SELECT * FROM notes WHERE noteId = ?", [noteId]);
    }

    createEntityFromRow(row) {
        let entity;

        if (row.labelId) {
            entity = new Label(this, row);
        }
        else if (row.noteRevisionId) {
            entity = new NoteRevision(this, row);
        }
        else if (row.branchId) {
            entity = new Branch(this, row);
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

        const clone = Object.assign({}, entity);

        delete clone.jsonContent;
        delete clone.repository;

        await sql.replace(entity.constructor.tableName, clone);

        const primaryKey = entity[entity.constructor.primaryKeyName];

        await sync_table.addEntitySync(entity.constructor.tableName, primaryKey);
    }
}

module.exports = Repository;