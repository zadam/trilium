"use strict";

const sql = require('../services/sql.js');
const NoteSet = require('../services/search/note_set.js');
const NotFoundError = require('../errors/not_found_error.js');

/**
 * Becca is a backend cache of all notes, branches, and attributes.
 * There's a similar frontend cache Froca, and share cache Shaca.
 */
class Becca {
    constructor() {
        this.reset();
    }

    reset() {
        /** @type {Object.<String, BNote>} */
        this.notes = {};
        /** @type {Object.<String, BBranch>} */
        this.branches = {};
        /** @type {Object.<String, BBranch>} */
        this.childParentToBranch = {};
        /** @type {Object.<String, BAttribute>} */
        this.attributes = {};
        /** @type {Object.<String, BAttribute[]>} Points from attribute type-name to list of attributes */
        this.attributeIndex = {};
        /** @type {Object.<String, BOption>} */
        this.options = {};
        /** @type {Object.<String, BEtapiToken>} */
        this.etapiTokens = {};

        this.dirtyNoteSetCache();

        this.loaded = false;
    }

    getRoot() {
        return this.getNote('root');
    }

    /** @returns {BAttribute[]} */
    findAttributes(type, name) {
        name = name.trim().toLowerCase();

        if (name.startsWith('#') || name.startsWith('~')) {
            name = name.substr(1);
        }

        return this.attributeIndex[`${type}-${name}`] || [];
    }

    /** @returns {BAttribute[]} */
    findAttributesWithPrefix(type, name) {
        const resArr = [];
        const key = `${type}-${name}`;

        for (const idx in this.attributeIndex) {
            if (idx.startsWith(key)) {
                resArr.push(this.attributeIndex[idx]);
            }
        }

        return resArr.flat();
    }

    decryptProtectedNotes() {
        for (const note of Object.values(this.notes)) {
            note.decrypt();
        }
    }

    addNote(noteId, note) {
        this.notes[noteId] = note;
        this.dirtyNoteSetCache();
    }

    /** @returns {BNote|null} */
    getNote(noteId) {
        return this.notes[noteId];
    }

    /** @returns {BNote|null} */
    getNoteOrThrow(noteId) {
        const note = this.notes[noteId];
        if (!note) {
            throw new NotFoundError(`Note '${noteId}' doesn't exist.`);
        }

        return note;
    }

    /** @returns {BNote[]} */
    getNotes(noteIds, ignoreMissing = false) {
        const filteredNotes = [];

        for (const noteId of noteIds) {
            const note = this.notes[noteId];

            if (!note) {
                if (ignoreMissing) {
                    continue;
                }

                throw new Error(`Note '${noteId}' was not found in becca.`);
            }

            filteredNotes.push(note);
        }

        return filteredNotes;
    }

    /** @returns {BBranch|null} */
    getBranch(branchId) {
        return this.branches[branchId];
    }

    /** @returns {BBranch|null} */
    getBranchOrThrow(branchId) {
        const branch = this.getBranch(branchId);
        if (!branch) {
            throw new NotFoundError(`Branch '${branchId}' was not found in becca.`);
        }
        return branch;
    }

    /** @returns {BAttribute|null} */
    getAttribute(attributeId) {
        return this.attributes[attributeId];
    }

    /** @returns {BAttribute} */
    getAttributeOrThrow(attributeId) {
        const attribute = this.getAttribute(attributeId);
        if (!attribute) {
            throw new NotFoundError(`Attribute '${attributeId}' does not exist.`);
        }

        return attribute;
    }

    /** @returns {BBranch|null} */
    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }

    /** @returns {BRevision|null} */
    getRevision(revisionId) {
        const row = sql.getRow("SELECT * FROM revisions WHERE revisionId = ?", [revisionId]);

        const BRevision = require('./entities/brevision.js'); // avoiding circular dependency problems
        return row ? new BRevision(row) : null;
    }

    /** @returns {BAttachment|null} */
    getAttachment(attachmentId, opts = {}) {
        opts.includeContentLength = !!opts.includeContentLength;

        const query = opts.includeContentLength
            ? `SELECT attachments.*, LENGTH(blobs.content) AS contentLength
               FROM attachments 
               JOIN blobs USING (blobId) 
               WHERE attachmentId = ? AND isDeleted = 0`
            : `SELECT * FROM attachments WHERE attachmentId = ? AND isDeleted = 0`;

        const BAttachment = require('./entities/battachment.js'); // avoiding circular dependency problems

        return sql.getRows(query, [attachmentId])
            .map(row => new BAttachment(row))[0];
    }

    /** @returns {BAttachment} */
    getAttachmentOrThrow(attachmentId, opts = {}) {
        const attachment = this.getAttachment(attachmentId, opts);
        if (!attachment) {
            throw new NotFoundError(`Attachment '${attachmentId}' has not been found.`);
        }
        return attachment;
    }

    /** @returns {BAttachment[]} */
    getAttachments(attachmentIds) {
        const BAttachment = require('./entities/battachment.js'); // avoiding circular dependency problems
        return sql.getManyRows("SELECT * FROM attachments WHERE attachmentId IN (???) AND isDeleted = 0", attachmentIds)
            .map(row => new BAttachment(row));
    }

    /** @returns {BBlob|null} */
    getBlob(entity) {
        const row = sql.getRow("SELECT *, LENGTH(content) AS contentLength FROM blobs WHERE blobId = ?", [entity.blobId]);

        const BBlob = require('./entities/bblob.js'); // avoiding circular dependency problems
        return row ? new BBlob(row) : null;
    }

    /** @returns {BOption|null} */
    getOption(name) {
        return this.options[name];
    }

    /** @returns {BEtapiToken[]} */
    getEtapiTokens() {
        return Object.values(this.etapiTokens);
    }

    /** @returns {BEtapiToken|null} */
    getEtapiToken(etapiTokenId) {
        return this.etapiTokens[etapiTokenId];
    }

    /** @returns {AbstractBeccaEntity|null} */
    getEntity(entityName, entityId) {
        if (!entityName || !entityId) {
            return null;
        }

        if (entityName === 'revisions') {
            return this.getRevision(entityId);
        } else if (entityName === 'attachments') {
            return this.getAttachment(entityId);
        }

        const camelCaseEntityName = entityName.toLowerCase().replace(/(_[a-z])/g,
            group =>
                group
                    .toUpperCase()
                    .replace('_', '')
        );

        if (!(camelCaseEntityName in this)) {
            throw new Error(`Unknown entity name '${camelCaseEntityName}' (original argument '${entityName}')`);
        }

        return this[camelCaseEntityName][entityId];
    }

    /** @returns {BRecentNote[]} */
    getRecentNotesFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        const BRecentNote = require('./entities/brecent_note.js'); // avoiding circular dependency problems
        return rows.map(row => new BRecentNote(row));
    }

    /** @returns {BRevision[]} */
    getRevisionsFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        const BRevision = require('./entities/brevision.js'); // avoiding circular dependency problems
        return rows.map(row => new BRevision(row));
    }

    /** Should be called when the set of all non-skeleton notes changes (added/removed) */
    dirtyNoteSetCache() {
        this.allNoteSetCache = null;
    }

    getAllNoteSet() {
        // caching this since it takes 10s of milliseconds to fill this initial NoteSet for many notes
        if (!this.allNoteSetCache) {
            const allNotes = [];

            for (const noteId in becca.notes) {
                const note = becca.notes[noteId];

                // in the process of loading data sometimes we create "skeleton" note instances which are expected to be filled later
                // in case of inconsistent data this might not work and search will then crash on these
                if (note.type !== undefined) {
                    allNotes.push(note);
                }
            }

            this.allNoteSetCache = new NoteSet(allNotes);
        }

        return this.allNoteSetCache;
    }
}

const becca = new Becca();

module.exports = becca;
