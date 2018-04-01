"use strict";

const Entity = require('./entity');

class RecentNote extends Entity {
    static get tableName() { return "recent_notes"; }
    static get primaryKeyName() { return "branchId"; }
}

module.exports = RecentNote;