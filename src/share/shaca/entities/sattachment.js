"use strict";

const sql = require('../../sql.js');
const utils = require('../../../services/utils.js');
const AbstractShacaEntity = require('./abstract_shaca_entity.js');

class SAttachment extends AbstractShacaEntity {
    constructor([attachmentId, ownerId, role, mime, title, blobId, utcDateModified]) {
        super();

        /** @param {string} */
        this.attachmentId = attachmentId;
        /** @param {string} */
        this.ownerId = ownerId;
        /** @param {string} */
        this.title = title;
        /** @param {string} */
        this.role = role;
        /** @param {string} */
        this.mime = mime;
        /** @param {string} */
        this.blobId = blobId;
        /** @param {string} */
        this.utcDateModified = utcDateModified; // used for caching of images

        this.shaca.attachments[this.attachmentId] = this;
        this.shaca.notes[this.ownerId].attachments.push(this);
    }

    /** @returns {SNote} */
    get note() {
        return this.shaca.notes[this.ownerId];
    }

    getContent(silentNotFoundError = false) {
        const row = sql.getRow(`SELECT content FROM blobs WHERE blobId = ?`, [this.blobId]);

        if (!row) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error(`Cannot find blob for attachment '${this.attachmentId}', blob '${this.blobId}'`);
            }
        }

        let content = row.content;

        if (this.hasStringContent()) {
            return content === null
                ? ""
                : content.toString("utf-8");
        }
        else {
            return content;
        }
    }

    /** @returns {boolean} true if the attachment has string content (not binary) */
    hasStringContent() {
        return utils.isStringNote(null, this.mime);
    }

    getPojo() {
        return {
            attachmentId: this.attachmentId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            position: this.position,
            blobId: this.blobId,
            utcDateModified: this.utcDateModified
        };
    }
}

module.exports = SAttachment;
