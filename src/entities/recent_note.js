"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * RecentNote represents recently visited note.
 *
 * @property {string} noteId
 * @property {string} notePath
 * @property {string} utcDateCreated
 *
 * @extends Entity
 */
class RecentNote extends Entity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "noteId"; }

    beforeSaving() {
        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();
    }
}

module.exports = RecentNote;
