"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const utils = require('../services/utils');

class Label extends Entity {
    static get tableName() { return "labels"; }
    static get primaryKeyName() { return "labelId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }

        this.dateModified = utils.nowDate();
    }
}

module.exports = Label;