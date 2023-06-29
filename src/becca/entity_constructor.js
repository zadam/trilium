const BAttachment = require("./entities/battachment");
const BAttribute = require('./entities/battribute');
const BBlob = require("./entities/bblob");
const BBranch = require('./entities/bbranch');
const BEtapiToken = require('./entities/betapi_token');
const BNote = require('./entities/bnote');
const BOption = require('./entities/boption');
const BRecentNote = require('./entities/brecent_note');
const BRevision = require('./entities/brevision');

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
