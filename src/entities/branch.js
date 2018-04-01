"use strict";

const Entity = require('./entity');
const utils = require('../services/utils');
const repository = require('../services/repository');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        this.dateModified = utils.nowDate()
    }
}

module.exports = Branch;