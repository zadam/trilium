"use strict";

const protectedSessionService = require('../../services/protected_session.js');
const utils = require('../../services/utils.js');
const dateUtils = require('../../services/date_utils.js');
const becca = require('../becca.js');
const AbstractBeccaEntity = require('./abstract_becca_entity.js');
const sql = require('../../services/sql.js');
const BAttachment = require('./battachment.js');

/**
 * Revision represents a snapshot of note's title and content at some point in the past.
 * It's used for seamless note versioning.
 *
 * @extends AbstractBeccaEntity
 */
class BRevision extends AbstractBeccaEntity {
    static get entityName() { return "revisions"; }
    static get primaryKeyName() { return "revisionId"; }
    static get hashedProperties() { return ["revisionId", "noteId", "title", "isProtected", "dateLastEdited", "dateCreated",
                                            "utcDateLastEdited", "utcDateCreated", "utcDateModified", "blobId"]; }

    constructor(row, titleDecrypted = false) {
        super();

        /** @type {string} */
        this.revisionId = row.revisionId;
        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.type = row.type;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /** @type {string} */
        this.title = row.title;
        /** @type {string} */
        this.blobId = row.blobId;
        /** @type {string} */
        this.dateLastEdited = row.dateLastEdited;
        /** @type {string} */
        this.dateCreated = row.dateCreated;
        /** @type {string} */
        this.utcDateLastEdited = row.utcDateLastEdited;
        /** @type {string} */
        this.utcDateCreated = row.utcDateCreated;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
        /** @type {int} */
        this.contentLength = row.contentLength;

        if (this.isProtected && !titleDecrypted) {
            this.title = protectedSessionService.isProtectedSessionAvailable()
                ? protectedSessionService.decryptString(this.title)
                : "[protected]";
        }
    }

    getNote() {
        return becca.notes[this.noteId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    hasStringContent() {
        return utils.isStringNote(this.type, this.mime);
    }

    isContentAvailable() {
        return !this.revisionId // new note which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    /*
     * Note revision content has quite special handling - it's not a separate entity, but a lazily loaded
     * part of Revision entity with its own sync. The reason behind this hybrid design is that
     * content can be quite large, and it's not necessary to load it / fill memory for any note access even
     * if we don't need a content, especially for bulk operations like search.
     *
     * This is the same approach as is used for Note's content.
     */

    /** @returns {string|Buffer} */
    getContent() {
        return this._getContent();
    }

    /**
     * @returns {*}
     * @throws Error in case of invalid JSON */
    getJsonContent() {
        const content = this.getContent();

        if (!content || !content.trim()) {
            return null;
        }

        return JSON.parse(content);
    }

    /** @returns {*|null} valid object or null if the content cannot be parsed as JSON */
    getJsonContentSafely() {
        try {
            return this.getJsonContent();
        }
        catch (e) {
            return null;
        }
    }

    /**
     * @param content
     * @param {object} [opts]
     * @param {object} [opts.forceSave=false] - will also save this BRevision entity
     */
    setContent(content, opts) {
        this._setContent(content, opts);
    }

    /** @returns {BAttachment[]} */
    getAttachments() {
        return sql.getRows(`
                SELECT attachments.*
                FROM attachments 
                WHERE ownerId = ? 
                  AND isDeleted = 0`, [this.revisionId])
            .map(row => new BAttachment(row));
    }

    /** @returns {BAttachment|null} */
    getAttachmentById(attachmentId, opts = {}) {
        opts.includeContentLength = !!opts.includeContentLength;

        const query = opts.includeContentLength
            ? `SELECT attachments.*, LENGTH(blobs.content) AS contentLength
               FROM attachments 
               JOIN blobs USING (blobId) 
               WHERE ownerId = ? AND attachmentId = ? AND isDeleted = 0`
            : `SELECT * FROM attachments WHERE ownerId = ? AND attachmentId = ? AND isDeleted = 0`;

        return sql.getRows(query, [this.revisionId, attachmentId])
            .map(row => new BAttachment(row))[0];
    }

    /** @returns {BAttachment[]} */
    getAttachmentsByRole(role) {
        return sql.getRows(`
                SELECT attachments.*
                FROM attachments 
                WHERE ownerId = ? 
                  AND role = ?
                  AND isDeleted = 0
                ORDER BY position`, [this.revisionId, role])
            .map(row => new BAttachment(row));
    }

    /** @returns {BAttachment} */
    getAttachmentByTitle(title) {
        // cannot use SQL to filter by title since it can be encrypted
        return this.getAttachments().filter(attachment => attachment.title === title)[0];
    }

    beforeSaving() {
        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            revisionId: this.revisionId,
            noteId: this.noteId,
            type: this.type,
            mime: this.mime,
            isProtected: this.isProtected,
            title: this.title,
            blobId: this.blobId,
            dateLastEdited: this.dateLastEdited,
            dateCreated: this.dateCreated,
            utcDateLastEdited: this.utcDateLastEdited,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified,
            content: this.content, // used when retrieving full note revision to frontend
            contentLength: this.contentLength
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();
        delete pojo.content; // not getting persisted
        delete pojo.contentLength; // not getting persisted

        if (pojo.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.title = protectedSessionService.encrypt(this.title);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        return pojo;
    }
}

module.exports = BRevision;
