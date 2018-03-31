"use strict";

const Entity = require('./entity');
const protected_session = require('../services/protected_session');
const repository = require('../services/repository');

class NoteRevision extends Entity {
    static get tableName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }

    constructor(row) {
        super(row);

        if (this.isProtected) {
            protected_session.decryptNoteRevision(this);
        }
    }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        if (this.isProtected) {
            protected_session.encryptNoteRevision(this);
        }
    }
}

module.exports = NoteRevision;