"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const AbstractBeccaEntity = require("./abstract_becca_entity");

/**
 * NoteRevision represents snapshot of note's title and content at some point in the past.
 * It's used for seamless note versioning.
 *
 * @extends AbstractBeccaEntity
 */
class BNoteRevision extends AbstractBeccaEntity {
    static get entityName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }
    static get hashedProperties() { return ["noteRevisionId", "noteId", "title", "isProtected", "dateLastEdited", "dateCreated", "utcDateLastEdited", "utcDateCreated", "utcDateModified"]; }

    constructor(row, titleDecrypted = false) {
        super();

        /** @type {string} */
        this.noteRevisionId = row.noteRevisionId;
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
        /** @type {number} */
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
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    isContentAvailable() {
        return !this.noteRevisionId // new note which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    /*
     * Note revision content has quite special handling - it's not a separate entity, but a lazily loaded
     * part of NoteRevision entity with its own sync. Reason behind this hybrid design is that
     * content can be quite large, and it's not necessary to load it / fill memory for any note access even
     * if we don't need a content, especially for bulk operations like search.
     *
     * This is the same approach as is used for Note's content.
     */

    /** @returns {*} */
    getContent() {
        return this._getContent();
    }

    /**
     * @param content
     * @param {object} [opts]
     * @param {object} [opts.forceSave=false] - will also save this BNoteRevision entity
     */
    setContent(content, opts) {
        this._setContent(content, opts);
    }

    beforeSaving() {
        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteRevisionId: this.noteRevisionId,
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

module.exports = BNoteRevision;
