"use strict";

const utils = require('../../services/utils.js');
const dateUtils = require('../../services/date_utils.js');
const AbstractBeccaEntity = require('./abstract_becca_entity.js');
const sql = require('../../services/sql.js');
const protectedSessionService = require('../../services/protected_session.js');
const log = require('../../services/log.js');

const attachmentRoleToNoteTypeMapping = {
    'image': 'image'
};

/**
 * Attachment represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 *
 * @extends AbstractBeccaEntity
 */
class BAttachment extends AbstractBeccaEntity {
    static get entityName() { return "attachments"; }
    static get primaryKeyName() { return "attachmentId"; }
    static get hashedProperties() { return ["attachmentId", "ownerId", "role", "mime", "title", "blobId", "utcDateScheduledForErasureSince"]; }

    constructor(row) {
        super();

        if (!row.ownerId?.trim()) {
            throw new Error("'ownerId' must be given to initialize a Attachment entity");
        } else if (!row.role?.trim()) {
            throw new Error("'role' must be given to initialize a Attachment entity");
        } else if (!row.mime?.trim()) {
            throw new Error("'mime' must be given to initialize a Attachment entity");
        } else if (!row.title?.trim()) {
            throw new Error("'title' must be given to initialize a Attachment entity");
        }

        /** @type {string} */
        this.attachmentId = row.attachmentId;
        /**
         * either noteId or revisionId to which this attachment belongs
         * @type {string}
         */
        this.ownerId = row.ownerId;
        /** @type {string} */
        this.role = row.role;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {string} */
        this.title = row.title;
        /** @type {int} */
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
        this.utcDateScheduledForErasureSince = row.utcDateScheduledForErasureSince;

        /**
         * optionally added to the entity
         * @type {int}
         */
        this.contentLength = row.contentLength;

        this.decrypt();
    }

    /** @returns {BAttachment} */
    copy() {
        return new BAttachment({
            ownerId: this.ownerId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            blobId: this.blobId,
            isProtected: this.isProtected
        });
    }

    /** @returns {BNote} */
    getNote() {
        return this.becca.notes[this.ownerId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    hasStringContent() {
        return utils.isStringNote(this.type, this.mime);
    }

    isContentAvailable() {
        return !this.attachmentId // new attachment which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    getTitleOrProtected() {
        return this.isContentAvailable() ? this.title : '[protected]';
    }

    decrypt() {
        if (!this.isProtected || !this.attachmentId) {
            this.isDecrypted = true;
            return;
        }

        if (!this.isDecrypted && protectedSessionService.isProtectedSessionAvailable()) {
            try {
                this.title = protectedSessionService.decryptString(this.title);
                this.isDecrypted = true;
            }
            catch (e) {
                log.error(`Could not decrypt attachment ${this.attachmentId}: ${e.message} ${e.stack}`);
            }
        }
    }

    /** @returns {string|Buffer}  */
    getContent() {
        return this._getContent();
    }

    /**
     * @param content
     * @param {object} [opts]
     * @param {object} [opts.forceSave=false] - will also save this BAttachment entity
     * @param {object} [opts.forceFrontendReload=false] - override frontend heuristics on when to reload, instruct to reload
     */
    setContent(content, opts) {
        this._setContent(content, opts);
    }

    /** @returns {{note: BNote, branch: BBranch}} */
    convertToNote() {
        if (this.type === 'search') {
            throw new Error(`Note of type search cannot have child notes`);
        }

        if (!this.getNote()) {
            throw new Error("Cannot find note of this attachment. It is possible that this is note revision's attachment. " +
                "Converting note revision's attachments to note is not (yet) supported.");
        }

        if (!(this.role in attachmentRoleToNoteTypeMapping)) {
            throw new Error(`Mapping from attachment role '${this.role}' to note's type is not defined`);
        }

        if (!this.isContentAvailable()) { // isProtected is the same for attachment
            throw new Error(`Cannot convert protected attachment outside of protected session`);
        }

        const noteService = require('../../services/notes.js');

        const { note, branch } = noteService.createNewNote({
            parentNoteId: this.ownerId,
            title: this.title,
            type: attachmentRoleToNoteTypeMapping[this.role],
            mime: this.mime,
            content: this.getContent(),
            isProtected: this.isProtected
        });

        this.markAsDeleted();

        const parentNote = this.getNote();

        if (this.role === 'image' && parentNote.type === 'text') {
            const origContent = parentNote.getContent();
            const oldAttachmentUrl = `api/attachments/${this.attachmentId}/image/`;
            const newNoteUrl = `api/images/${note.noteId}/`;

            const fixedContent = utils.replaceAll(origContent, oldAttachmentUrl, newNoteUrl);

            if (fixedContent !== origContent) {
                parentNote.setContent(fixedContent);
            }

            noteService.asyncPostProcessContent(note, fixedContent);
        }

        return { note, branch };
    }

    getFileName() {
        const type = this.role === 'image' ? 'image' : 'file';

        return utils.formatDownloadTitle(this.title, type, this.mime);
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.position === undefined || this.position === null) {
            this.position = 10 + sql.getValue(`SELECT COALESCE(MAX(position), 0)
                                              FROM attachments
                                              WHERE ownerId = ?`, [this.noteId]);
        }

        this.dateModified = dateUtils.localNowDateTime();
        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            attachmentId: this.attachmentId,
            ownerId: this.ownerId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            position: this.position,
            blobId: this.blobId,
            isProtected: !!this.isProtected,
            isDeleted: false,
            dateModified: this.dateModified,
            utcDateModified: this.utcDateModified,
            utcDateScheduledForErasureSince: this.utcDateScheduledForErasureSince,
            contentLength: this.contentLength
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();
        delete pojo.contentLength;

        if (pojo.isProtected) {
            if (this.isDecrypted) {
                pojo.title = protectedSessionService.encrypt(pojo.title);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        return pojo;
    }
}

module.exports = BAttachment;
