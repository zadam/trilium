"use strict";

const utils = require('../../services/utils');
const dateUtils = require('../../services/date_utils');
const AbstractBeccaEntity = require("./abstract_becca_entity");
const sql = require("../../services/sql");
const protectedSessionService = require("../../services/protected_session.js");

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
    static get hashedProperties() { return ["attachmentId", "parentId", "role", "mime", "title", "blobId",
                                            "utcDateScheduledForErasureSince", "utcDateModified"]; }

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
        this.utcDateScheduledForErasureSince = row.utcDateScheduledForErasureSince;
    }

    /** @returns {BAttachment} */
    copy() {
        return new BAttachment({
            parentId: this.parentId,
            role: this.role,
            mime: this.mime,
            title: this.title,
            blobId: this.blobId,
            isProtected: this.isProtected
        });
    }

    getNote() {
        return this.becca.notes[this.parentId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    isContentAvailable() {
        return !this.attachmentId // new attachment which was not encrypted yet
            || !this.isProtected
            || protectedSessionService.isProtectedSessionAvailable()
    }

    /** @returns {*} */
    getContent() {
        return this._getContent();
    }

    /**
     * @param content
     * @param {object} [opts]
     * @param {object} [opts.forceSave=false] - will also save this BAttachment entity
     * @param {object} [opts.forceCold=false] - blob has to be saved as cold
     */
    setContent(content, opts) {
        this._setContent(content, opts);
    }

    /**
     * @returns {{note: BNote, branch: BBranch}}
     */
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

        if (!this.isContentAvailable()) { // isProtected is same for attachment
            throw new Error(`Cannot convert protected attachment outside of protected session`);
        }

        const noteService = require('../../services/notes');

        const { note, branch } = noteService.createNewNote({
            parentNoteId: this.parentId,
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
        }

        return { note, branch };
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
            utcDateScheduledForErasureSince: this.utcDateScheduledForErasureSince
        };
    }

    getPojoToSave() {
        return this.getPojo();
    }
}

module.exports = BAttachment;
