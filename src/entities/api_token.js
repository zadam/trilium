"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class ApiToken extends Entity {
    static get tableName() { return "api_tokens"; }
    static get primaryKeyName() { return "apiTokenId"; }
    static get syncedProperties() { return ["apiTokenId", "token", "dateCreated", "isDeleted"]; }

    beforeSaving() {
        super.beforeSaving();

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }
    }
}

module.exports = ApiToken;