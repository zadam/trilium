const Note = require('../entities/note');
const NoteRevision = require('../entities/note_revision');
const Branch = require('../entities/branch');
const Attribute = require('../entities/attribute');
const RecentNote = require('../entities/recent_note');
const ApiToken = require('../entities/api_token');
const Option = require('../entities/option');
const repository = require('../services/repository');
const cls = require('../services/cls');

const ENTITY_NAME_TO_ENTITY = {
    "attributes": Attribute,
    "branches": Branch,
    "notes": Note,
    "note_contents": Note,
    "note_revisions": NoteRevision,
    "note_revision_contents": NoteRevision,
    "recent_notes": RecentNote,
    "options": Option,
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

        cls.setEntityToCache('attributes', row.attributeId, entity);
    }
    else if (row.noteRevisionId) {
        entity = new NoteRevision(row);

        cls.setEntityToCache('note_revisions', row.noteRevisionId, entity);
    }
    else if (row.branchId && row.notePath) {
        entity = new RecentNote(row);
    }
    else if (row.apiTokenId) {
        entity = new ApiToken(row);
    }
    else if (row.branchId) {
        entity = new Branch(row);

        cls.setEntityToCache('branches', row.branchId, entity);
    }
    else if (row.noteId) {
        entity = new Note(row);

        cls.setEntityToCache('notes', row.noteId, entity);
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
    getEntityFromEntityName
};

repository.setEntityConstructor(module.exports);
