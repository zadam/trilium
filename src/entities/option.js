"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class Option extends Entity {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    constructor(row) {
        super(row);

        this.isSynced = !!this.isSynced;
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.isChanged) {
            this.dateModified = dateUtils.nowDate();
        }
    }
}

module.exports = Option;