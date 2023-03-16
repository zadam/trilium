const BNote = require('./entities/bnote');
const BNoteRevision = require('./entities/bnote_revision');
const BNoteAncillary = require("./entities/bnote_attachment.js");
const BBranch = require('./entities/bbranch');
const BAttribute = require('./entities/battribute');
const BRecentNote = require('./entities/brecent_note');
const BEtapiToken = require('./entities/betapi_token');
const BOption = require('./entities/boption');

const ENTITY_NAME_TO_ENTITY = {
    "attributes": BAttribute,
    "branches": BBranch,
    "notes": BNote,
    "note_revisions": BNoteRevision,
    "note_ancillaries": BNoteAncillary,
    "recent_notes": BRecentNote,
    "etapi_tokens": BEtapiToken,
    "options": BOption
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
