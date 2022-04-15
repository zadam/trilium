"use strict";

const dateUtils = require('../../services/date_utils');
const AbstractEntity = require("./abstract_entity");

/**
 * Option represents name-value pair, either directly configurable by the user or some system property.
 *
 * @extends AbstractEntity
 */
class Option extends AbstractEntity {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    constructor(row) {
        super();

        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.value = row.value;
        /** @type {boolean} */
        this.isSynced = !!row.isSynced;
        /** @type {string} */
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
            utcDateModified: this.utcDateModified
        }
    }
}

module.exports = Option;
