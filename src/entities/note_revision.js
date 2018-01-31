"use strict";

const Entity = require('./entity');

class NoteRevision extends Entity {
    static get tableName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }

    async getNote() {
        return this.repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = NoteRevision;