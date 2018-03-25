"use strict";

const Entity = require('./entity');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }

    async getNote() {
        return this.repository.getEntity("SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    async getParentNote() {
        return this.repository.getEntity("SELECT * FROM branches WHERE isDeleted = 0 AND parentNoteId = ?", [this.parentNoteId]);
    }
}

module.exports = Branch;