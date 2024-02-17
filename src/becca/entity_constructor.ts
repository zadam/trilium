import BAttachment = require('./entities/battachment');
import BAttribute = require('./entities/battribute');
import BBlob = require('./entities/bblob');
import BBranch = require('./entities/bbranch');
import BEtapiToken = require('./entities/betapi_token');
import BNote = require('./entities/bnote');
import BOption = require('./entities/boption');
import BRecentNote = require('./entities/brecent_note');
import BRevision = require('./entities/brevision');

const ENTITY_NAME_TO_ENTITY: Record<string, any> = {
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

function getEntityFromEntityName(entityName: keyof typeof ENTITY_NAME_TO_ENTITY) {
    if (!(entityName in ENTITY_NAME_TO_ENTITY)) {
        throw new Error(`Entity for table '${entityName}' not found!`);
    }

    return ENTITY_NAME_TO_ENTITY[entityName];
}

export = {
    getEntityFromEntityName
};
