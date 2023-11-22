const BAttachment = require('./entities/battachment.js');
const BAttribute = require('./entities/battribute.js');
const BBlob = require('./entities/bblob.js');
const BBranch = require('./entities/bbranch.js');
const BEtapiToken = require('./entities/betapi_token.js');
const BNote = require('./entities/bnote.js');
const BOption = require('./entities/boption.js');
const BRecentNote = require('./entities/brecent_note.js');
const BRevision = require('./entities/brevision.js');

const ENTITY_NAME_TO_ENTITY = {
    "attachments": BAttachment,
    "attributes": BAttribute,
    "blobs": BBlob,
    "branches": BBranch,
    "etapi_tokens": BEtapiToken,
    "notes": BNote,
    "options": BOption,
    "recent_notes": BRecentNote,
    "revisions": BRevision
};

function getEntityFromEntityName(entityName) {
    if (!(entityName in ENTITY_NAME_TO_ENTITY)) {
        throw new Error(`Entity for table '${entityName}' not found!`);
    }

    return ENTITY_NAME_TO_ENTITY[entityName];
}

module.exports = {
    getEntityFromEntityName
};
