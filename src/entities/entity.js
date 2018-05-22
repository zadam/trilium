"use strict";

const utils = require('../services/utils');
const repository = require('../services/repository');

class Entity {
    constructor(row = {}) {
        for (const key in row) {
            this[key] = row[key];
        }
    }

    beforeSaving() {
        if (!this[this.constructor.primaryKeyName]) {
            this[this.constructor.primaryKeyName] = utils.newEntityId();
        }

        let contentToHash = "";

        for (const propertyName of this.constructor.syncedProperties) {
            contentToHash += "|" + this[propertyName];
        }

        this["hash"] = utils.hash(contentToHash).substr(0, 10);
    }

    async save() {
        await repository.updateEntity(this);

        return this;
    }
}

module.exports = Entity;