"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

class Relation extends Entity {
    static get tableName() { return "relations"; }
    static get primaryKeyName() { return "relationId"; }
    static get hashedProperties() { return ["relationId", "sourceNoteId", "name", "targetNoteId", "dateModified", "dateCreated"]; }

    async getSourceNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.sourceNoteId]);
    }

    async getTargetNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.targetNoteId]);
    }

    async beforeSaving() {
        super.beforeSaving();

        if (this.position === undefined) {
            this.position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM relations WHERE sourceNoteId = ?`, [this.sourceNoteId]);
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        this.dateModified = dateUtils.nowDate();
    }
}

module.exports = Relation;