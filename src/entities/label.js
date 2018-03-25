"use strict";

const Entity = require('./entity');

class Label extends Entity {
    static get tableName() { return "labels"; }
    static get primaryKeyName() { return "labelId"; }

    async getNote() {
        return this.repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = Label;