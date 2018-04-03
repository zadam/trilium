"use strict";

const utils = require('../services/utils');
const repository = require('../services/repository');

class Entity {
    constructor(row = {}) {
        utils.assertArguments(row);

        for (const key in row) {
            this[key] = row[key];
        }
    }

    beforeSaving() {
        if (!this[this.constructor.primaryKeyName]) {
            this[this.constructor.primaryKeyName] = utils.newEntityId();
        }
    }

    async save() {
        await repository.updateEntity(this);
    }
}

module.exports = Entity;