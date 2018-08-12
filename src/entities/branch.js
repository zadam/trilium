"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const repository = require('../services/repository');
const sql = require('../services/sql');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "isDeleted", "prefix"]; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async beforeSaving() {
        if (this.notePosition === undefined) {
            const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [this.parentNoteId]);
            this.notePosition = maxNotePos === null ? 0 : maxNotePos + 1;
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.dateModified = dateUtils.nowDate();
        }
    }
}

module.exports = Branch;