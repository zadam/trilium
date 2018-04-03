"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');
const utils = require('../services/utils');

class NoteImage extends Entity {
    static get tableName() { return "note_images"; }
    static get primaryKeyName() { return "noteImageId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }

    async getImage() {
        return await repository.getEntity("SELECT * FROM images WHERE imageId = ?", [this.imageId]);
    }

    beforeSaving() {
        super.beforeSaving();

        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = utils.nowDate();
        }

        this.dateModified = utils.nowDate();
    }
}

module.exports = NoteImage;