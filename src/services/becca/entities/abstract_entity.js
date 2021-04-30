"use strict";

const utils = require('../../utils');

let becca = null;
let repo = null;

class AbstractEntity {
    beforeSaving() {
        this.generateIdIfNecessary();
    }

    generateIdIfNecessary() {
        if (!this[this.constructor.primaryKeyName]) {
            this[this.constructor.primaryKeyName] = utils.newEntityId();
        }
    }

    generateHash() {
        let contentToHash = "";

        for (const propertyName of this.constructor.hashedProperties) {
            contentToHash += "|" + this[propertyName];
        }

        return utils.hash(contentToHash).substr(0, 10);
    }

    getUtcDateChanged() {
        // FIXME
        return this.utcDateModified || this.utcDateCreated || "FAKE";
    }

    get becca() {
        if (!becca) {
            becca = require('../becca');
        }

        return becca;
    }

    // temporarily needed for saving entities
    get repository() {
        if (!repo) {
            repo = require('../../repository');
        }

        return repo;
    }

    save() {
        this.repository.updateEntity(this);

        return this;
    }
}

module.exports = AbstractEntity;
