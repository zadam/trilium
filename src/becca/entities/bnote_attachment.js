"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const entityChangesService = require('../../services/entity_changes');
const AbstractBeccaEntity = require("./abstract_becca_entity");

/**
 * NoteAttachment represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 *
 * @extends AbstractBeccaEntity
 */
class BNoteAttachment extends AbstractBeccaEntity {
    static get entityName() { return "note_attachments"; }
    static get primaryKeyName() { return "noteAttachmentId"; }
    static get hashedProperties() { return ["noteAttachmentId", "noteId", "name", "content", "utcDateModified"]; }

    constructor(row) {
        super();

        /** @type {string} */
        this.noteAttachmentId = row.noteAttachmentId;
        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
    }

    getNote() {
        return becca.notes[this.noteId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /** @returns {*} */
    getContent(silentNotFoundError = false) {
        const res = sql.getRow(`SELECT content FROM note_attachment_contents WHERE noteAttachmentId = ?`, [this.noteAttachmentId]);

        if (!res) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error(`Cannot find note attachment content for noteAttachmentId=${this.noteAttachmentId}`);
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

    setContent(content) {
        const pojo = {
            noteAttachmentId: this.noteAttachmentId,
            content: content,
            utcDateModified: dateUtils.utcNowDateTime()
        };

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.content = protectedSessionService.encrypt(pojo.content);
            }
            else {
                throw new Error(`Cannot update content of noteAttachmentId=${this.noteAttachmentId} since we're out of protected session.`);
            }
        }

        sql.upsert("note_attachment_contents", "noteAttachmentId", pojo);

        const hash = utils.hash(`${this.noteAttachmentId}|${pojo.content.toString()}`);

        entityChangesService.addEntityChange({
            entityName: 'note_attachment_contents',
            entityId: this.noteAttachmentId,
            hash: hash,
            isErased: false,
            utcDateChanged: this.getUtcDateChanged(),
            isSynced: true
        });
    }

    beforeSaving() {
        if (!this.name.match(/^[a-z0-9]+$/i)) {
            throw new Error(`Name must be alphanumerical, "${this.name}" given.`);
        }

        this.noteAttachmentId = `${this.noteId}_${this.name}`;

        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteAttachmentId: this.noteAttachmentId,
            noteId: this.noteId,
            name: this.name,
            mime: this.mime,
            isProtected: !!this.isProtected,
            isDeleted: false,
            utcDateModified: this.utcDateModified,
            content: this.content,
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();
        delete pojo.content; // not getting persisted

        return pojo;
    }
}

module.exports = BNoteAttachment;
