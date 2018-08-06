"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class Option extends Entity {
    static get tableName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    beforeSaving() {
        this.dateModified = dateUtils.nowDate();

        super.beforeSaving();
    }
}

module.exports = Option;