const becca = require('../becca/becca');
const NotFoundError = require("../errors/not_found_error");
const protectedSessionService = require("./protected_session");

function getBlobPojo(entityName, entityId, opts = {}) {
    opts.preview = !!opts.preview;

    const entity = becca.getEntity(entityName, entityId);

    if (!entity) {
        throw new NotFoundError(`Entity ${entityName} '${entityId}' was not found.`);
    }

    const blob = becca.getBlob(entity);

    const pojo = blob.getPojo();

    if (!entity.hasStringContent()) {
        pojo.content = null;
    } else {
        pojo.content = processContent(pojo.content, entity.isProtected, true);

        if (opts.preview && pojo.content.length > 10000) {
            pojo.content = `${pojo.content.substr(0, 10000)}\r\n\r\n... and ${pojo.content.length - 10000} more characters.`;
        }
    }

    return pojo;
}

function processContent(content, isProtected, isStringContent) {
    if (isProtected) {
        if (protectedSessionService.isProtectedSessionAvailable()) {
            content = content === null ? null : protectedSessionService.decrypt(content);
        } else {
            content = "";
        }
    }

    if (isStringContent) {
        return content === null ? "" : content.toString("utf-8");
    } else {
        // see https://github.com/zadam/trilium/issues/3523
        // IIRC a zero-sized buffer can be returned as null from the database
        if (content === null) {
            // this will force de/encryption
            content = Buffer.alloc(0);
        }

        return content;
    }
}

module.exports = {
    getBlobPojo,
    processContent
};
