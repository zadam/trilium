"use strict";

const utils = require('../services/utils');

class Entity {
    constructor(row) {
        utils.assertArguments(row);

        for (const key in row) {
            this[key] = row[key];
        }
    }
}

module.exports = Entity;