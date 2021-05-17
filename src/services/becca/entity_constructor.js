const Note = require('./entities/note');
const NoteRevision = require('./entities/note_revision.js');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');
const RecentNote = require('./entities/recent_note.js');
const ApiToken = require('./entities/api_token.js');

const ENTITY_NAME_TO_ENTITY = {
    "attributes": Attribute,
    "branches": Branch,
    "notes": Note,
    "note_contents": Note,
    "note_revisions": NoteRevision,
    "note_revision_contents": NoteRevision,
    "recent_notes": RecentNote,
    "api_tokens": ApiToken,
};

function getEntityFromEntityName(entityName) {
    if (!(entityName in ENTITY_NAME_TO_ENTITY)) {
        throw new Error(`Entity for table ${entityName} not found!`);
    }

    return ENTITY_NAME_TO_ENTITY[entityName];
}

function createEntityFromRow(row) {
    let entity;

    if (row.attributeId) {
        entity = new Attribute(row);
    }
    else if (row.noteRevisionId) {
        entity = new NoteRevision(row);
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
    else {
        throw new Error('Unknown entity type for row: ' + JSON.stringify(row));
    }

    return entity;
}

module.exports = {
    createEntityFromRow,
    getEntityFromEntityName
};
