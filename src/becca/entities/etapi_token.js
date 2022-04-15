"use strict";

const dateUtils = require('../../services/date_utils');
const AbstractEntity = require("./abstract_entity");

/**
 * EtapiToken is an entity representing token used to authenticate against Trilium REST API from client applications.
 * Used by:
 * - Trilium Sender
 * - ETAPI clients
 *
 * The format user is presented with is "<etapiTokenId>_<tokenHash>". This is also called "authToken" to distinguish it
 * from tokenHash and token.
 *
 * @extends AbstractEntity
 */
class EtapiToken extends AbstractEntity {
    static get entityName() { return "etapi_tokens"; }
    static get primaryKeyName() { return "etapiTokenId"; }
    static get hashedProperties() { return ["etapiTokenId", "name", "tokenHash", "utcDateCreated", "utcDateModified", "isDeleted"]; }

    constructor(row) {
        super();

        if (!row) {
            return;
        }

        this.updateFromRow(row);
        this.init();
    }

    updateFromRow(row) {
        /** @type {string} */
        this.etapiTokenId = row.etapiTokenId;
        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.tokenHash = row.tokenHash;
        /** @type {string} */
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
        /** @type {string} */
        this.utcDateModified = row.utcDateModified || this.utcDateCreated;
        /** @type {boolean} */
        this.isDeleted = !!row.isDeleted;

        if (this.etapiTokenId) {
            this.becca.etapiTokens[this.etapiTokenId] = this;
        }
    }

    init() {
        if (this.etapiTokenId) {
            this.becca.etapiTokens[this.etapiTokenId] = this;
        }
    }

    getPojo() {
        return {
            etapiTokenId: this.etapiTokenId,
            name: this.name,
            tokenHash: this.tokenHash,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified,
            isDeleted: this.isDeleted
        }
    }

    beforeSaving() {
        this.utcDateModified = dateUtils.utcNowDateTime();

        super.beforeSaving();

        this.becca.etapiTokens[this.etapiTokenId] = this;
    }
}

module.exports = EtapiToken;
