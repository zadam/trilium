"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

class Image extends Entity {
    static get tableName() { return "images"; }
    static get primaryKeyName() { return "imageId"; }

    beforeSaving() {
        super.beforeSaving();

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        this.dateModified = dateUtils.nowDate();
    }
}

module.exports = Image;