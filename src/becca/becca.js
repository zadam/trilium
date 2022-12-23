"use strict";

const sql = require("../services/sql");
const NoteSet = require("../services/search/note_set");

/**
 * Becca is a backend cache of all notes, branches and attributes. There's a similar frontend cache Froca.
 */
class Becca {
    constructor() {
        this.reset();
    }

    reset() {
        /** @type {Object.<String, Note>} */
        this.notes = {};
        /** @type {Object.<String, Branch>} */
        this.branches = {};
        /** @type {Object.<String, Branch>} */
        this.childParentToBranch = {};
        /** @type {Object.<String, Attribute>} */
        this.attributes = {};
        /** @type {Object.<String, Attribute[]>} Points from attribute type-name to list of attributes */
        this.attributeIndex = {};
        /** @type {Object.<String, Option>} */
        this.options = {};
        /** @type {Object.<String, EtapiToken>} */
        this.etapiTokens = {};

        this.dirtyNoteSetCache();

        this.loaded = false;
    }

    getRoot() {
        return this.getNote('root');
    }

    /** @returns {Attribute[]} */
    findAttributes(type, name) {
        name = name.trim().toLowerCase();

        if (name.startsWith('#') || name.startsWith('~')) {
            name = name.substr(1);
        }

        return this.attributeIndex[`${type}-${name}`] || [];
    }

    /** @returns {Attribute[]} */
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

    /** @returns {Note|null} */
    getNote(noteId) {
        return this.notes[noteId];
    }

    /** @returns {Note[]} */
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

    /** @returns {Branch|null} */
    getBranch(branchId) {
        return this.branches[branchId];
    }

    /** @returns {Attribute|null} */
    getAttribute(attributeId) {
        return this.attributes[attributeId];
    }

    /** @returns {Branch|null} */
    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }

    /** @returns {NoteRevision|null} */
    getNoteRevision(noteRevisionId) {
        const row = sql.getRow("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [noteRevisionId]);

        const NoteRevision = require("./entities/note_revision"); // avoiding circular dependency problems
        return row ? new NoteRevision(row) : null;
    }

    /** @returns {Option|null} */
    getOption(name) {
        return this.options[name];
    }

    /** @returns {EtapiToken[]} */
    getEtapiTokens() {
        return Object.values(this.etapiTokens);
    }

    /** @returns {EtapiToken|null} */
    getEtapiToken(etapiTokenId) {
        return this.etapiTokens[etapiTokenId];
    }

    getEntity(entityName, entityId) {
        if (!entityName || !entityId) {
            return null;
        }

        if (entityName === 'note_revisions') {
            return this.getNoteRevision(entityId);
        }

        const camelCaseEntityName = entityName.toLowerCase().replace(/(_[a-z])/g,
            group =>
                group
                    .toUpperCase()
                    .replace('_', '')
        );

        return this[camelCaseEntityName][entityId];
    }

    /** @returns {RecentNote[]} */
    getRecentNotesFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        const RecentNote = require("./entities/recent_note"); // avoiding circular dependency problems
        return rows.map(row => new RecentNote(row));
    }

    /** @returns {NoteRevision[]} */
    getNoteRevisionsFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        const NoteRevision = require("./entities/note_revision"); // avoiding circular dependency problems
        return rows.map(row => new NoteRevision(row));
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
