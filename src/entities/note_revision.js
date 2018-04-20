"use strict";

const Entity = require('./entity');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');

class NoteRevision extends Entity {
    static get tableName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }

    constructor(row) {
        super(row);

        if (this.isProtected) {
            protectedSessionService.decryptNoteRevision(this);
        }
    }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.isProtected) {
            protectedSessionService.encryptNoteRevision(this);
        }
    }
}

module.exports = NoteRevision;