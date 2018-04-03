"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

class Label extends Entity {
    static get tableName() { return "labels"; }
    static get primaryKeyName() { return "labelId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async beforeSaving() {
        super.beforeSaving();

        if (!this.value) {
            // null value isn't allowed
            this.value = "";
        }

        if (this.position === undefined) {
            this.position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM labels WHERE noteId = ?`, [this.noteId]);
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

module.exports = Label;