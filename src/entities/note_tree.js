"use strict";

const Entity = require('./entity');

class NoteTree extends Entity {
    async getNote() {
        return this.sql.getEntity("SELECT * FROM note_tree WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    async getParentNote() {
        return this.sql.getEntity("SELECT * FROM note_tree WHERE isDeleted = 0 AND parentNoteId = ?", [this.parentNoteId]);
    }
}

module.exports = NoteTree;