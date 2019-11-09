"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * RecentNote represents recently visited note.
 *
 * @property {string} noteId
 * @property {string} notePath
 * @property {boolean} isDeleted
 * @property {string} utcDateModified
 *
 * @extends Entity
 */
class RecentNote extends Entity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "notePath", "utcDateCreated", "isDeleted"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();
    }
}

module.exports = RecentNote;