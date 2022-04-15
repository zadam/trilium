"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const entityChangesService = require('../../services/entity_changes');
const AbstractEntity = require("./abstract_entity");

/**
 * NoteRevision represents snapshot of note's title and content at some point in the past.
 * It's used for seamless note versioning.
 *
 * @extends AbstractEntity
 */
class NoteRevision extends AbstractEntity {
    static get entityName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }
    static get hashedProperties() { return ["noteRevisionId", "noteId", "title", "isProtected", "dateLastEdited", "dateCreated", "utcDateLastEdited", "utcDateCreated", "utcDateModified"]; }

    constructor(row) {
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

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                this.title = protectedSessionService.decryptString(this.title);
            }
            else {
                this.title = "[protected]";
            }
        }
    }

    getNote() {
        return becca.notes[this.noteId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /*
     * Note revision content has quite special handling - it's not a separate entity, but a lazily loaded
     * part of NoteRevision entity with it's own sync. Reason behind this hybrid design is that
     * content can be quite large and it's not necessary to load it / fill memory for any note access even
     * if we don't need a content, especially for bulk operations like search.
     *
     * This is the same approach as is used for Note's content.
     */

    /** @returns {*} */
    getContent(silentNotFoundError = false) {
        const res = sql.getRow(`SELECT content FROM note_revision_contents WHERE noteRevisionId = ?`, [this.noteRevisionId]);

        if (!res) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error("Cannot find note revision content for noteRevisionId=" + this.noteRevisionId);
            }
        }

        let content = res.content;

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                content = protectedSessionService.decrypt(content);
            }
            else {
                content = "";
            }
        }

        if (this.isStringNote()) {
            return content === null
                ? ""
                : content.toString("UTF-8");
        }
        else {
            return content;
        }
    }

    setContent(content, ignoreMissingProtectedSession = false) {
        const pojo = {
            noteRevisionId: this.noteRevisionId,
            content: content,
            utcDateModified: dateUtils.utcNowDateTime()
        };

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.content = protectedSessionService.encrypt(pojo.content);
            }
            else if (!ignoreMissingProtectedSession) {
                throw new Error(`Cannot update content of noteRevisionId=${this.noteRevisionId} since we're out of protected session.`);
            }
        }

        sql.upsert("note_revision_contents", "noteRevisionId", pojo);

        const hash = utils.hash(this.noteRevisionId + "|" + pojo.content.toString());

        entityChangesService.addEntityChange({
            entityName: 'note_revision_contents',
            entityId: this.noteRevisionId,
            hash: hash,
            isErased: false,
            utcDateChanged: this.getUtcDateChanged(),
            isSynced: true
        });
    }

    /** @returns {{contentLength, dateModified, utcDateModified}} */
    getContentMetadata() {
        return sql.getRow(`
            SELECT 
                LENGTH(content) AS contentLength, 
                dateModified,
                utcDateModified 
            FROM note_revision_contents 
            WHERE noteRevisionId = ?`, [this.noteRevisionId]);
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
            dateLastEdited: this.dateLastEdited,
            dateCreated: this.dateCreated,
            utcDateLastEdited: this.utcDateLastEdited,
            utcDateCreated: this.utcDateCreated,
            utcDateModified: this.utcDateModified,
            content: this.content,
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

module.exports = NoteRevision;
