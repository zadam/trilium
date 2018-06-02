"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class Option extends Entity {
    static get tableName() { return "options"; }
    static get primaryKeyName() { return "optionId"; }
    static get hashedProperties() { return ["optionId", "name", "value"]; }

    beforeSaving() {
        super.beforeSaving();

        this.dateModified = dateUtils.nowDate();
    }
}

module.exports = Option;