"use strict";

const Entity = require('./entity');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');

/**
 * NoteRevision represents snapshot of note's title and content at some point in the past. It's used for seamless note versioning.
 *
 * @param {string} noteRevisionId
 * @param {string} noteId
 * @param {string} type
 * @param {string} mime
 * @param {string} title
 * @param {string} content
 * @param {string} isProtected
 * @param {string} dateModifiedFrom
 * @param {string} dateModifiedTo
 * @param {string} utcDateModifiedFrom
 * @param {string} utcDateModifiedTo
 *
 * @extends Entity
 */
class NoteRevision extends Entity {
    static get entityName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }
    static get hashedProperties() { return ["noteRevisionId", "noteId", "title", "content", "isProtected", "dateModifiedFrom", "dateModifiedTo", "utcDateModifiedFrom", "utcDateModifiedTo"]; }

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