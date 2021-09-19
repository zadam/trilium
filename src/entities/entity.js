"use strict";

const utils = require('../services/utils');
let repo = null;

class Entity {
    /**
     * @param {object} [row] - database row representing given entity
     */
    constructor(row = {}) {
        for (const key in row) {
            // ! is used when joint-fetching notes and note_contents objects for performance
            if (!key.startsWith('!')) {
                this[key] = row[key];
            }
        }

        if ('isDeleted' in this && this.constructor.entityName !== 'recent_notes') {
            this.isDeleted = !!this.isDeleted;
        }
    }

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

module.exports = Entity;
