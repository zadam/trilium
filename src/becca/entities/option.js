"use strict";

const dateUtils = require('../../services/date_utils.js');
const AbstractEntity = require("./abstract_entity.js");

/**
 * Option represents name-value pair, either directly configurable by the user or some system property.
 */
class Option extends AbstractEntity {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    constructor(row) {
        super();

        this.name = row.name;
        this.value = row.value;
        this.isSynced = !!row.isSynced;
        this.utcDateModified = row.utcDateModified;

        this.becca.options[this.name] = this;
    }

    beforeSaving() {
        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            name: this.name,
            value: this.value,
            isSynced: this.isSynced,
            utcDateModified: this.utcDateModified,
            // utcDateCreated is scheduled for removal so the value does not matter
            utcDateCreated: dateUtils.utcNowDateTime()
        }
    }
}

module.exports = Option;
