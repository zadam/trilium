"use strict";

const dateUtils = require('../../services/date_utils.js');
const AbstractEntity = require("./abstract_entity.js");

/**
 * ApiToken is an entity representing token used to authenticate against Trilium API from client applications. Currently used only by Trilium Sender.
 */
class ApiToken extends AbstractEntity {
    static get entityName() { return "api_tokens"; }
    static get primaryKeyName() { return "apiTokenId"; }
    static get hashedProperties() { return ["apiTokenId", "token", "utcDateCreated"]; }

    constructor(row) {
        super();

        /** @type {string} */
        this.apiTokenId = row.apiTokenId;
        /** @type {string} */
        this.token = row.token;
        /** @type {string} */
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            apiTokenId: this.apiTokenId,
            token: this.token,
            utcDateCreated: this.utcDateCreated
        }
    }
}

module.exports = ApiToken;
