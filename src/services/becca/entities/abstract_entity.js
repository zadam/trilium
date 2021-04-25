"use strict";

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
        return this.utcDateModified || this.utcDateCreated;
    }

    get repository() {
        if (!repo) {
            repo = require('../services/repository');
        }

        return repo;
    }

    save() {
        this.repository.updateEntity(this);

        return this;
    }
}

module.exports = AbstractEntity;
