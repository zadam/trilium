"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * This class represents image data.
 *
 * @param {string} imageId
 * @param {string} format
 * @param {string} checksum
 * @param {string} name
 * @param {blob} data
 * @param {boolean} isDeleted
 * @param {string} dateModified
 * @param {string} dateCreated
 *
 * @extends Entity
 */
class Image extends Entity {
    static get entityName() { return "images"; }
    static get primaryKeyName() { return "imageId"; }
    static get hashedProperties() { return ["imageId", "format", "checksum", "name", "isDeleted", "dateCreated"]; }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.dateModified = dateUtils.nowDate();
        }
    }
}

module.exports = Image;