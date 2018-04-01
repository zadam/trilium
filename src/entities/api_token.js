"use strict";

const Entity = require('./entity');
const utils = require('../services/utils');

class ApiToken extends Entity {
    static get tableName() { return "api_tokens"; }
    static get primaryKeyName() { return "apiTokenId"; }

    beforeSaving() {
        if (!this.apiTokenId) {
            this.apiTokenId = utils.newApiTokenId();
        }

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }
    }
}

module.exports = ApiToken;