"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * RecentNote represents recently visited note.
 *
 * @param {string} branchId
 * @param {string} notePath
 * @param {boolean} isDeleted
 * @param {string} utcDateModified
 *
 * @extends Entity
 */
class RecentNote extends Entity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "branchId"; }
    static get hashedProperties() { return ["branchId", "notePath", "utcDateCreated", "isDeleted"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();
    }
}

module.exports = RecentNote;