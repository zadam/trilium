const Note = require('./entities/note');
const NoteRevision = require('./entities/note_revision');
const Branch = require('./entities/branch');
const Attribute = require('./entities/attribute');
const RecentNote = require('./entities/recent_note');
const EtapiToken = require('./entities/etapi_token');
const Option = require('./entities/option');

const ENTITY_NAME_TO_ENTITY = {
    "attributes": Attribute,
    "branches": Branch,
    "notes": Note,
    "note_contents": Note,
    "note_revisions": NoteRevision,
    "note_revision_contents": NoteRevision,
    "recent_notes": RecentNote,
    "etapi_tokens": EtapiToken,
    "options": Option
};

function getEntityFromEntityName(entityName) {
    if (!(entityName in ENTITY_NAME_TO_ENTITY)) {
        throw new Error(`Entity for table ${entityName} not found!`);
    }

    return ENTITY_NAME_TO_ENTITY[entityName];
}

module.exports = {
    getEntityFromEntityName
};
