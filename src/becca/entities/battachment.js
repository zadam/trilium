"use strict";

const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const AbstractBeccaEntity = require("./abstract_becca_entity");
const sql = require("../../services/sql");

/**
 * Attachment represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 *
 * @extends AbstractBeccaEntity
 */
class BAttachment extends AbstractBeccaEntity {
    static get entityName() { return "attachments"; }
    static get primaryKeyName() { return "attachmentId"; }
    static get hashedProperties() { return ["attachmentId", "parentId", "role", "mime", "title", "blobId",
                                            "utcDateScheduledForDeletionSince", "utcDateModified"]; }

    constructor(row) {
        super();

        if (!row.parentId?.trim()) {
            throw new Error("'parentId' must be given to initialize a Attachment entity");
        } else if (!row.role?.trim()) {
            throw new Error("'role' must be given to initialize a Attachment entity");
        } else if (!row.mime?.trim()) {
            throw new Error("'mime' must be given to initialize a Attachment entity");
        } else if (!row.title?.trim()) {
            throw new Error("'title' must be given to initialize a Attachment entity");
        }

        /** @type {string} */
        this.attachmentId = row.attachmentId;
        /** @type {string} either noteId or noteRevisionId to which this attachment belongs */
        this.parentId = row.parentId;
        /** @type {string} */
        this.role = row.role;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {string} */
        this.title = row.title;
        /** @type {number} */
        this.position = row.position;
        /** @type {string} */
        this.blobId = row.blobId;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /** @type {string} */
        this.dateModified = row.dateModified;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
        /** @type {string} */
        this.utcDateScheduledForDeletionSince = row.utcDateScheduledForDeletionSince;
    }

    getNote() {
        return becca.notes[this.parentId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /** @returns {*} */
    getContent() {
        return this._getContent();
    }

    /**
     * @param content
     * @param {object} [opts]
     * @param {object} [opts.forceSave=false] - will also save this BAttachment entity
     */
    setContent(content, opts) {
        this._setContent(content, opts);
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.position === undefined || this.position === null) {
            this.position = 10 + sql.getValue(`SELECT COALESCE(MAX(position), 0)
                                              FROM attachments
                                              WHERE parentId = ?`, [this.noteId]);
        }

        this.dateModified = dateUtils.localNowDateTime();
        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            attachmentId: this.attachmentId,
            parentId: this.parentId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            position: this.position,
            blobId: this.blobId,
            isProtected: !!this.isProtected,
            isDeleted: false,
            dateModified: this.dateModified,
            utcDateModified: this.utcDateModified,
            utcDateScheduledForDeletionSince: this.utcDateScheduledForDeletionSince
        };
    }

    getPojoToSave() {
        return this.getPojo();
    }
}

module.exports = BAttachment;
