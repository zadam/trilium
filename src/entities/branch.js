"use strict";

const Entity = require('./entity');
const utils = require('../services/utils');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }

    beforeSaving() {
        this.dateModified = utils.nowDate()
    }
}

module.exports = Branch;