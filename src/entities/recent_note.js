"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class RecentNote extends Entity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "branchId"; }
    static get hashedProperties() { return ["branchId", "notePath", "dateCreated", "isDeleted"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();
    }
}

module.exports = RecentNote;