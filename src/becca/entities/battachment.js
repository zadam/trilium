"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const entityChangesService = require('../../services/entity_changes');
const AbstractBeccaEntity = require("./abstract_becca_entity");

/**
 * Attachment represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 *
 * @extends AbstractBeccaEntity
 */
class BAttachment extends AbstractBeccaEntity {
    static get entityName() { return "attachments"; }
    static get primaryKeyName() { return "attachmentId"; }
    static get hashedProperties() { return ["attachmentId", "parentId", "role", "mime", "title", "utcDateModified"]; }

    constructor(row) {
        super();

        if (!row.parentId?.trim()) {
            throw new Error("'noteId' must be given to initialize a Attachment entity");
        } else if (!row.role?.trim()) {
            throw new Error("'role' must be given to initialize a Attachment entity");
        } else if (!row.mime?.trim()) {
            throw new Error("'mime' must be given to initialize a Attachment entity");
        } else if (!row.title?.trim()) {
            throw new Error("'title' must be given to initialize a Attachment entity");
        }

        /** @type {string} needs to be set at the initialization time since it's used in the .setContent() */
        this.attachmentId = row.attachmentId || `${this.noteId}_${this.name}`; // FIXME
        /** @type {string} either noteId or noteRevisionId to which this attachment belongs */
        this.parentId = row.parentId;
        /** @type {string} */
        this.role = row.role;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {string} */
        this.title = row.title;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /** @type {string} */
        this.utcDateModified = row.utcDateModified;
    }

    getNote() {
        return becca.notes[this.parentId];
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /** @returns {*} */
    getContent(silentNotFoundError = false) {
        const res = sql.getRow(`SELECT content FROM attachment_contents WHERE attachmentId = ?`, [this.attachmentId]);

        if (!res) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error(`Cannot find note attachment content for attachmentId=${this.attachmentId}`);
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
        sql.transactional(() => {
            this.save(); // also explicitly save attachment to update contentCheckSum

            const pojo = {
                attachmentId: this.attachmentId,
                content: content,
                utcDateModified: dateUtils.utcNowDateTime()
            };

            if (this.isProtected) {
                if (protectedSessionService.isProtectedSessionAvailable()) {
                    pojo.content = protectedSessionService.encrypt(pojo.content);
                } else {
                    throw new Error(`Cannot update content of attachmentId=${this.attachmentId} since we're out of protected session.`);
                }
            }

            sql.upsert("attachment_contents", "attachmentId", pojo);

            entityChangesService.addEntityChange({
                entityName: 'attachment_contents',
                entityId: this.attachmentId,
                hash: this.contentCheckSum, // FIXME
                isErased: false,
                utcDateChanged: pojo.utcDateModified,
                isSynced: true
            });
        });
    }

    calculateCheckSum(content) {
        return utils.hash(`${this.attachmentId}|${content.toString()}`);
    }

    beforeSaving() {
        if (!this.name.match(/^[a-z0-9]+$/i)) {
            throw new Error(`Name must be alphanumerical, "${this.name}" given.`);
        }

        this.attachmentId = `${this.noteId}_${this.name}`; // FIXME

        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            attachmentId: this.attachmentId,
            parentId: this.parentId,
            name: this.name,
            mime: this.mime,
            isProtected: !!this.isProtected,
            contentCheckSum: this.contentCheckSum, // FIXME
            isDeleted: false,
            utcDateModified: this.utcDateModified
        };
    }

    getPojoToSave() {
        const pojo = this.getPojo();
        delete pojo.content; // not getting persisted

        return pojo;
    }
}

module.exports = BAttachment;
