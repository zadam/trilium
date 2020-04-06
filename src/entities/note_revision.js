"use strict";

const Entity = require('./entity');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');
const utils = require('../services/utils');
const sql = require('../services/sql');
const dateUtils = require('../services/date_utils');
const syncTableService = require('../services/sync_table');

/**
 * NoteRevision represents snapshot of note's title and content at some point in the past. It's used for seamless note versioning.
 *
 * @property {string} noteRevisionId
 * @property {string} noteId
 * @property {string} type
 * @property {string} mime
 * @property {string} title
 * @property {int} contentLength
 * @property {boolean} isErased
 * @property {boolean} isProtected
 * @property {string} dateLastEdited
 * @property {string} dateCreated
 * @property {string} utcDateLastEdited
 * @property {string} utcDateCreated
 * @property {string} utcDateModified
 *
 * @extends Entity
 */
class NoteRevision extends Entity {
    static get entityName() { return "note_revisions"; }
    static get primaryKeyName() { return "noteRevisionId"; }
    static get hashedProperties() { return ["noteRevisionId", "noteId", "title", "contentLength", "isErased", "isProtected", "dateLastEdited", "dateCreated", "utcDateLastEdited", "utcDateCreated", "utcDateModified"]; }

    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                this.title = protectedSessionService.decryptString(this.title);
            }
            else {
                this.title = "[Protected]";
            }
        }
    }

    async getNote() {
        return await repository.getNote(this.noteId);
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

    /** @returns {Promise<*>} */
    async getContent(silentNotFoundError = false) {
        if (this.content === undefined) {
            const res = await sql.getRow(`SELECT content, hash FROM note_revision_contents WHERE noteRevisionId = ?`, [this.noteRevisionId]);

            if (!res) {
                if (silentNotFoundError) {
                    return undefined;
                }
                else {
                    throw new Error("Cannot find note revision content for noteRevisionId=" + this.noteRevisionId);
                }
            }

            this.content = res.content;

            if (this.isProtected) {
                if (protectedSessionService.isProtectedSessionAvailable()) {
                    this.content = protectedSessionService.decrypt(this.content);
                }
                else {
                    this.content = "";
                }
            }
        }

        if (this.isStringNote()) {
            return this.content === null
                ? ""
                : this.content.toString("UTF-8");
        }
        else {
            return this.content;
        }
    }

    /** @returns {Promise} */
    async setContent(content) {
        // force updating note itself so that utcDateModified is represented correctly even for the content
        this.forcedChange = true;
        this.contentLength = content === null ? 0 : content.length;
        await this.save();

        this.content = content;

        const pojo = {
            noteRevisionId: this.noteRevisionId,
            content: content,
            utcDateModified: dateUtils.utcNowDateTime(),
            hash: utils.hash(this.noteRevisionId + "|" + content)
        };

        if (this.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.content = protectedSessionService.encrypt(pojo.content);
            }
            else {
                throw new Error(`Cannot update content of noteRevisionId=${this.noteRevisionId} since we're out of protected session.`);
            }
        }

        await sql.upsert("note_revision_contents", "noteRevisionId", pojo);

        await syncTableService.addNoteRevisionContentSync(this.noteRevisionId);
    }

    beforeSaving() {
        super.beforeSaving();

        if (this.isChanged) {
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }

    // cannot be static!
    updatePojo(pojo) {
        if (pojo.isProtected) {
            if (protectedSessionService.isProtectedSessionAvailable()) {
                pojo.title = protectedSessionService.encrypt(pojo.title);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        delete pojo.content;
    }
}

module.exports = NoteRevision;