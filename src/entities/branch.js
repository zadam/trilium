"use strict";

const Entity = require('./entity');

class Branch extends Entity {
    static get tableName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
}

module.exports = Branch;