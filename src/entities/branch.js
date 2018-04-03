"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const repository = require('../services/repository');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        super.beforeSaving();

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        this.dateModified = dateUtils.nowDate()
    }
}

module.exports = Branch;