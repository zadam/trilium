"use strict";

const Entity = require('./entity');
const utils = require('../services/utils');

class Image extends Entity {
    static get tableName() { return "images"; }
    static get primaryKeyName() { return "imageId"; }

    beforeSaving() {
        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }

        this.dateModified = utils.nowDate();
    }
}

module.exports = Image;