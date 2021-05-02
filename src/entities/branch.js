"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');
const sql = require('../services/sql');

/**
 * Branch represents note's placement in the tree - it's essentially pair of noteId and parentNoteId.
 * Each note can have multiple (at least one) branches, meaning it can be placed into multiple places in the tree.
 *
 * @property {string} branchId - primary key, immutable
 * @property {string} noteId - immutable
 * @property {string} parentNoteId - immutable
 * @property {int} notePosition
 * @property {string} prefix
 * @property {boolean} isExpanded
 * @property {boolean} isDeleted
 * @property {string|null} deleteId - ID identifying delete transaction
 * @property {string} utcDateModified
 * @property {string} utcDateCreated
 *
 * @extends Entity
 */
class Branch extends Entity {
    static get entityName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "isDeleted", "deleteId", "prefix"]; }

    /** @returns {Note|null} */
    getNote() {
        return this.becca.getNote(this.noteId);
    }

    /** @returns {Note|null} */
    getParentNote() {
        return this.becca.getNote(this.parentNoteId);
    }

    beforeSaving() {
        if (this.notePosition === undefined || this.notePosition === null) {
            const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [this.parentNoteId]);
            this.notePosition = maxNotePos === null ? 0 : maxNotePos + 10;
        }

        if (!this.isExpanded) {
            this.isExpanded = false;
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    createClone(parentNoteId, notePosition) {
        return new Branch({
            noteId: this.noteId,
            parentNoteId: parentNoteId,
            notePosition: notePosition,
            prefix: this.prefix,
            isExpanded: this.isExpanded,
            isDeleted: false,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified
        });
    }
}

module.exports = Branch;
