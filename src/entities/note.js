"use strict";

const Entity = require('./entity');
const protected_session = require('../services/protected_session');

class Note extends Entity {
    static get tableName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }

    constructor(repository, row) {
        super(repository, row);

        if (this.isProtected) {
            protected_session.decryptNote(this.dataKey, this);
        }

        if (this.isJson()) {
            this.jsonContent = JSON.parse(this.content);
        }
    }

    isJson() {
        return this.type === "code" && this.mime === "application/json";
    }

    async getAttributes() {
        return this.repository.getEntities("SELECT * FROM attributes WHERE noteId = ? AND isDeleted = 0", [this.noteId]);
    }

    async getAttribute(name) {
        return this.repository.getEntity("SELECT * FROM attributes WHERE noteId = ? AND name = ?", [this.noteId, name]);
    }

    async getRevisions() {
        return this.repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }

    async getTrees() {
        return this.repository.getEntities("SELECT * FROM note_tree WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    beforeSaving() {
        this.content = JSON.stringify(this.jsonContent, null, '\t');

        if (this.isProtected) {
            protected_session.encryptNote(this.dataKey, this);
        }
    }
}

module.exports = Note;