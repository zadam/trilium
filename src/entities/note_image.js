"use strict";

const Entity = require('./entity');
const repository = require('../services/repository');

class NoteImage extends Entity {
    static get tableName() { return "note_images"; }
    static get primaryKeyName() { return "noteImageId"; }

    async getNote() {
        return await repository.getEntity("SELECT * FROM notes WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = NoteImage;