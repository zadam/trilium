"use strict";

import dateUtils = require('../../services/date_utils');
import AbstractBeccaEntity = require('./abstract_becca_entity');
import { OptionRow } from './rows';

/**
 * Option represents a name-value pair, either directly configurable by the user or some system property.
 */
class BOption extends AbstractBeccaEntity<BOption> {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    name!: string;
    value!: string;
    isSynced!: boolean;

    constructor(row?: OptionRow) {
        super();

        if (row) {
            this.updateFromRow(row);
        }
        this.becca.options[this.name] = this;
    }

    updateFromRow(row: OptionRow) {
        this.name = row.name;
        this.value = row.value;
        this.isSynced = !!row.isSynced;
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

export = BOption;
