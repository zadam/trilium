"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class ApiToken extends Entity {
    static get tableName() { return "api_tokens"; }
    static get primaryKeyName() { return "apiTokenId"; }
    static get hashedProperties() { return ["apiTokenId", "token", "dateCreated", "isDeleted"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();
    }
}

module.exports = ApiToken;