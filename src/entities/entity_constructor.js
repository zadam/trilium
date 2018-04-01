const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const NoteImage = require('../entities/note_image');
const Branch = require('../entities/branch');
const Label = require('../entities/label');
const repository = require('../services/repository');

function createEntityFromRow(row) {
    let entity;

    if (row.labelId) {
        entity = new Label(row);
    }
    else if (row.noteRevisionId) {
        entity = new NoteRevision(row);
    }
    else if (row.noteImageId) {
        entity = new NoteImage(row);
    }
    else if (row.branchId) {
        entity = new Branch(row);
    }
    else if (row.noteId) {
        entity = new Note(row);
    }
    else {
        throw new Error('Unknown entity type for row: ' + JSON.stringify(row));
    }

    return entity;
}

repository.setEntityConstructor(createEntityFromRow);

module.exports = {
    createEntityFromRow
};