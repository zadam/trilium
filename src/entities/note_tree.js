"use strict";

const Entity = require('./entity');

class NoteTree extends Entity {
    static get tableName() { return "note_tree"; }
    static get primaryKeyName() { return "noteTreeId"; }

    async getNote() {
        return this.repository.getEntity("SELECT * FROM note_tree WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    async getParentNote() {
        return this.repository.getEntity("SELECT * FROM note_tree WHERE isDeleted = 0 AND parentNoteId = ?", [this.parentNoteId]);
    }
}

module.exports = NoteTree;