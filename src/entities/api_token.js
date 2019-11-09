"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * ApiToken is an entity representing token used to authenticate against Trilium API from client applications. Currently used only by Trilium Sender.
 *
 * @property {string} apiTokenId - primary key
 * @property {string} token
 * @property {boolean} isDeleted - true if API token is deleted
 * @property {string} utcDateCreated
 *
 * @extends Entity
 */
class ApiToken extends Entity {
    static get entityName() { return "api_tokens"; }
    static get primaryKeyName() { return "apiTokenId"; }
    static get hashedProperties() { return ["apiTokenId", "token", "utcDateCreated", "isDeleted"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();
    }
}

module.exports = ApiToken;