"use strict";

const dateUtils = require('../../services/date_utils.js');
const AbstractBeccaEntity = require('./abstract_becca_entity.js');

/**
 * Option represents a name-value pair, either directly configurable by the user or some system property.
 *
 * @extends AbstractBeccaEntity
 */
class BOption extends AbstractBeccaEntity {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    constructor(row) {
        super();

        this.updateFromRow(row);
        this.becca.options[this.name] = this;
    }

    updateFromRow(row) {
        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.value = row.value;
        /** @type {boolean} */
        this.isSynced = !!row.isSynced;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
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

module.exports = BOption;
