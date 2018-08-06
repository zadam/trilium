"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const dateUtils = require('../services/date_utils');

class NoteImage extends Entity {
    static get tableName() { return "note_images"; }
    static get primaryKeyName() { return "noteImageId"; }
    static get hashedProperties() { return ["noteImageId", "noteId", "imageId", "isDeleted", "dateModified", "dateCreated"]; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async getImage() {
        return await repository.getEntity("SELECT * FROM images WHERE imageId = ?", [this.imageId]);
    }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.nowDate();
        }

        this.dateModified = dateUtils.nowDate();

        super.beforeSaving();
    }
}

module.exports = NoteImage;