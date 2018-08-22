"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * ApiToken is an entity representing token used to authenticate against Trilium API from client applications. Currently used only by Trilium Sender.
 *
 * @param {string} apiTokenId - primary key
 * @param {string} token
 * @param {boolean} isDeleted - true if API token is deleted
 * @param {string} dateCreated
 *
 * @extends Entity
 */
class ApiToken extends Entity {
    static get entityName() { return "api_tokens"; }
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