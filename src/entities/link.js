"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');

/**
 * This class represents link from one note to another in the form of hyperlink or image reference. Note that
 * this is different concept than attribute/relation.
 *
 * @param {string} linkId
 * @param {string} noteId
 * @param {string} targetNoteId
 * @param {string} type
 * @param {boolean} isDeleted
 * @param {string} utcDateModified
 * @param {string} utcDateCreated
 *
 * @extends Entity
 */
class Link extends Entity {
    static get entityName() { return "links"; }
    static get primaryKeyName() { return "linkId"; }
    static get hashedProperties() { return ["linkId", "noteId", "targetNoteId", "type", "isDeleted", "utcDateCreated", "utcDateModified"]; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async getTargetNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.targetNoteId]);
    }

    beforeSaving() {
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
}

module.exports = Link;