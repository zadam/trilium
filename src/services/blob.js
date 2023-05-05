const becca = require('../becca/becca');
const NotFoundError = require("../errors/not_found_error");

function getBlobPojo(entityName, entityId, opts = {}) {
    opts.full = !!opts.full;

    const entity = becca.getEntity(entityName, entityId);

    if (!entity) {
        throw new NotFoundError(`Entity ${entityName} '${entityId}' was not found.`);
    }

    const blob = becca.getBlob(entity.blobId);

    const pojo = blob.getPojo();

    if (!entity.hasStringContent()) {
        pojo.content = null;
    } else if (!opts.full && pojo.content.length > 10000) {
        pojo.content = `${pojo.content.substr(0, 10000)}\r\n\r\n... and ${pojo.content.length - 10000} more characters.`;
    }

    return pojo;
}

module.exports = {
    getBlobPojo
};