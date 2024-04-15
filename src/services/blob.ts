import becca = require('../becca/becca');
import NotFoundError = require('../errors/not_found_error');
import protectedSessionService = require('./protected_session');
import utils = require('./utils');
import type { Blob } from "./blob-interface";

function getBlobPojo(entityName: string, entityId: string, opts?: { preview: boolean }) {
    // TODO: Unused opts.
    const entity = becca.getEntity(entityName, entityId);
    if (!entity) {
        throw new NotFoundError(`Entity ${entityName} '${entityId}' was not found.`);
    }

    const blob = becca.getBlob(entity);
    if (!blob) {
        throw new NotFoundError(`Blob ${entity.blobId} for ${entityName} '${entityId}' was not found.`);
    }

    const pojo = blob.getPojo();

    if (!entity.hasStringContent()) {
        pojo.content = null;
    } else {
        pojo.content = processContent(pojo.content, !!entity.isProtected, true);
    }

    return pojo;
}

function processContent(content: Buffer | string | null, isProtected: boolean, isStringContent: boolean) {
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

function calculateContentHash({blobId, content}: Blob) {
    return utils.hash(`${blobId}|${content.toString()}`);
}

export = {
    getBlobPojo,
    processContent,
    calculateContentHash
};
