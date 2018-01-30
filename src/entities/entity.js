"use strict";

const utils = require('../services/utils');

class Entity {
    constructor(repository, row) {
        utils.assertArguments(repository, row);

        this.repository = repository;

        for (const key in row) {
            this[key] = row[key];
        }
    }
}

module.exports = Entity;