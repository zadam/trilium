"use strict";

const Entity = require('./entity');

class Option extends Entity {
    static get tableName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get syncedProperties() { return ["name", "value"]; }
}

module.exports = Option;