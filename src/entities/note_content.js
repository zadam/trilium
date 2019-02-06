"use strict";

const Entity = require('./entity');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');

/**
 * This represents a Note which is a central object in the Trilium Notes project.
 *
 * @property {string} noteContentId - primary key
 * @property {string} noteId - reference to owning note
 * @property {boolean} isProtected - true if note content is protected
 * @property {blob} content - note content - e.g. HTML text for text notes, file payload for files
 *
 * @extends Entity
 */
class NoteContent extends Entity {
    static get entityName() {
        return "note_contents";
    }

    static get primaryKeyName() {
        return "noteContentId";
    }

    static get hashedProperties() {
        return ["noteContentId", "noteId", "isProtected", "content"];
    }

    /**
     * @param row - object containing database row from "note_contents" table
     */
    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;
        /* true if content (meaning any kind of potentially encrypted content) is either not encrypted
         * or encrypted, but with available protected session (so effectively decrypted) */
        this.isContentAvailable = true;

        // check if there's noteContentId, otherwise this is a new entity which wasn't encrypted yet
        if (this.isProtected && this.noteContentId) {
            this.isContentAvailable = protectedSessionService.isProtectedSessionAvailable();

            if (this.isContentAvailable) {
                protectedSessionService.decryptNoteContent(this);
            }
            else {
                // saving ciphertexts in case we do want to update protected note outside of protected session
                // (which is allowed)
                this.contentCipherText = this.content;
                this.content = "";
            }
        }
    }

    /**
     * @returns {Promise<Note>}
     */
    async getNote() {
        return await repository.getNote(this.noteId);
    }

    // cannot be static!
    updatePojo(pojo) {
        if (pojo.isProtected) {
            if (this.isContentAvailable) {
                protectedSessionService.encryptNoteContent(pojo);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertext
                pojo.content = pojo.contentCipherText;
            }
        }

        delete pojo.jsonContent;
        delete pojo.isContentAvailable;
        delete pojo.contentCipherText;
    }
}

module.exports = NoteContent;