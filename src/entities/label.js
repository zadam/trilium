"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');

class Label extends Entity {
    static get tableName() { return "labels"; }
    static get primaryKeyName() { return "labelId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = Label;