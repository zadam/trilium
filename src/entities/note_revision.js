"use strict";

const Entity = require('./entity');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');

class NoteRevision extends Entity {
    static get tableName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }
    static get hashedProperties() { return ["noteRevisionId", "noteId", "title", "content", "isProtected", "dateModifiedFrom", "dateModifiedTo"]; }

    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;

        if (this.isProtected) {
            protectedSessionService.decryptNoteRevision(this);
        }
    }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        if (this.isProtected) {
            protectedSessionService.encryptNoteRevision(this);
        }

        super.beforeSaving();
    }
}

module.exports = NoteRevision;