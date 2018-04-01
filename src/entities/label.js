"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const utils = require('../services/utils');
const sql = require('../services/sql');

class Label extends Entity {
    static get tableName() { return "labels"; }
    static get primaryKeyName() { return "labelId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async beforeSaving() {
        if (!this.labelId) {
            this.labelId = utils.newLabelId();
        }

        if (this.value) {
            // null value isn't allowed
            this.value = "";
        }

        if (this.position === undefined) {
            this.position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM labels WHERE noteId = ?`, [noteId]);
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }

        this.dateModified = utils.nowDate();
    }
}

module.exports = Label;