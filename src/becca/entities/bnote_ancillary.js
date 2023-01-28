"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const becca = require('../becca');
const entityChangesService = require('../../services/entity_changes');
const AbstractBeccaEntity = require("./abstract_becca_entity");

/**
 * NoteAncillary represent data related/attached to the note. Conceptually similar to attributes, but intended for
 * larger amounts of data and generally not accessible to the user.
 *
 * @extends AbstractBeccaEntity
 */
class BNoteAncillary extends AbstractBeccaEntity {
    static get entityName() { return "note_ancillaries"; }
    static get primaryKeyName() { return "noteAncillaryId"; }
    static get hashedProperties() { return ["noteAncillaryId", "noteId", "name", "content", "utcDateModified"]; }

    constructor(row) {
        super();

        if (!row.noteId) {
            throw new Error("'noteId' must be given to initialize a NoteAncillary entity");
        }

        if (!row.name) {
            throw new Error("'name' must be given to initialize a NoteAncillary entity");
        }

        /** @type {string} needs to be set at the initialization time since it's used in the .setContent() */
        this.noteAncillaryId = row.noteAncillaryId || `${this.noteId}_${this.name}`;
        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.mime = row.mime;
        /** @type {boolean} */
        this.isProtected = !!row.isProtected;
        /** @type {string} */
        this.contentCheckSum = row.contentCheckSum;
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
        const res = sql.getRow(`SELECT content FROM note_ancillary_contents WHERE noteAncillaryId = ?`, [this.noteAncillaryId]);

        if (!res) {
            if (silentNotFoundError) {
                return undefined;
            }
            else {
                throw new Error(`Cannot find note ancillary content for noteAncillaryId=${this.noteAncillaryId}`);
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
            this.contentCheckSum = this.calculateCheckSum(content);
            this.save(); // also explicitly save note_ancillary to update contentCheckSum

            const pojo = {
                noteAncillaryId: this.noteAncillaryId,
                content: content,
                utcDateModified: dateUtils.utcNowDateTime()
            };

            if (this.isProtected) {
                if (protectedSessionService.isProtectedSessionAvailable()) {
                    pojo.content = protectedSessionService.encrypt(pojo.content);
                } else {
                    throw new Error(`Cannot update content of noteAncillaryId=${this.noteAncillaryId} since we're out of protected session.`);
                }
            }

            sql.upsert("note_ancillary_contents", "noteAncillaryId", pojo);

            entityChangesService.addEntityChange({
                entityName: 'note_ancillary_contents',
                entityId: this.noteAncillaryId,
                hash: this.contentCheckSum,
                isErased: false,
                utcDateChanged: pojo.utcDateModified,
                isSynced: true
            });
        });
    }

    calculateCheckSum(content) {
        return utils.hash(`${this.noteAncillaryId}|${content.toString()}`);
    }

    beforeSaving() {
        if (!this.name.match(/^[a-z0-9]+$/i)) {
            throw new Error(`Name must be alphanumerical, "${this.name}" given.`);
        }

        this.noteAncillaryId = `${this.noteId}_${this.name}`;

        super.beforeSaving();

        this.utcDateModified = dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteAncillaryId: this.noteAncillaryId,
            noteId: this.noteId,
            name: this.name,
            mime: this.mime,
            isProtected: !!this.isProtected,
            contentCheckSum: this.contentCheckSum,
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

module.exports = BNoteAncillary;
