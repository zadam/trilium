const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const Image = require('../entities/image');
const NoteImage = require('../entities/note_image');
const Branch = require('../entities/branch');
const Attribute = require('../entities/attribute');
const RecentNote = require('../entities/recent_note');
const ApiToken = require('../entities/api_token');
const Option = require('../entities/option');
const repository = require('../services/repository');

const TABLE_NAME_TO_ENTITY = {
    "attributes": Attribute.constructor,
    "images": Image.constructor,
    "note_images": NoteImage.constructor,
    "branches": Branch.constructor,
    "notes": Note.constructor,
    "note_revisions": NoteRevision.constructor,
    "recent_notes": RecentNote.constructor,
    "options": Option.constructor,
    "api_tokens": ApiToken.constructor,
};

function getEntityFromTableName(tableName) {
    return TABLE_NAME_TO_ENTITY[tableName];
}

function createEntityFromRow(row) {
    let entity;

    if (row.attributeId) {
        entity = new Attribute(row);
    }
    else if (row.noteRevisionId) {
        entity = new NoteRevision(row);
    }
    else if (row.noteImageId) {
        entity = new NoteImage(row);
    }
    else if (row.imageId) {
        entity = new Image(row);
    }
    else if (row.branchId && row.notePath) {
        entity = new RecentNote(row);
    }
    else if (row.apiTokenId) {
        entity = new ApiToken(row);
    }
    else if (row.branchId) {
        entity = new Branch(row);
    }
    else if (row.noteId) {
        entity = new Note(row);
    }
    else if (row.name) {
        entity = new Option(row);
    }
    else {
        throw new Error('Unknown entity type for row: ' + JSON.stringify(row));
    }

    return entity;
}

module.exports = {
    createEntityFromRow,
    getEntityFromTableName
};

repository.setEntityConstructor(module.exports);
