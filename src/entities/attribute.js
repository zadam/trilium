"use strict";

const Entity = require('./entity');

class Attribute extends Entity {
    static get tableName() { return "attributes"; }

    async getNote() {
        return this.repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = Attribute;