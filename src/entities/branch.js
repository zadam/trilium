"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const repository = require('../services/repository');
const sql = require('../services/sql');

/**
 * Branch represents note's placement in the tree - it's essentially pair of noteId and parentNoteId.
 * Each note can have multiple (at least one) branches, meaning it can be placed into multiple places in the tree.
 *
 * @param {string} branchId - primary key
 * @param {string} noteId
 * @param {string} parentNoteId
 * @param {int} notePosition
 * @param {string} prefix
 * @param {boolean} isExpanded
 * @param {boolean} isDeleted
 * @param {string} utcDateModified
 * @param {string} utcDateCreated
 *
 * @extends Entity
 */
class Branch extends Entity {
    static get entityName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "isDeleted", "prefix"]; }

    constructor(row = {}) {
        super(row);

        // used to detect move in note tree
        this.origParentNoteId = this.parentNoteId;
    }

    /** @returns {Note|null} */
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

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }

    // cannot be static!
    updatePojo(pojo) {
        delete pojo.origParentNoteId;
    }
}

module.exports = Branch;