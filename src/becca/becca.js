"use strict";

const sql = require("../services/sql.js");
const NoteRevision = require("./entities/note_revision.js");
const RecentNote = require("./entities/recent_note.js");

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

        this.loaded = false;
    }

    /** @return {Attribute[]} */
    findAttributes(type, name) {
        return this.attributeIndex[`${type}-${name.toLowerCase()}`] || [];
    }

    /** @return {Attribute[]} */
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

    getNote(noteId) {
        return this.notes[noteId];
    }

    getNotes(noteIds) {
        const filteredNotes = [];

        for (const noteId of noteIds) {
            const note = this.notes[noteId];

            if (!note) {
                throw new Error(`Note '${noteId}' was not found in becca.`);
            }

            filteredNotes.push(note);
        }

        return filteredNotes;
    }

    getBranch(branchId) {
        return this.branches[branchId];
    }

    getAttribute(attributeId) {
        return this.attributes[attributeId];
    }

    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }

    getNoteRevision(noteRevisionId) {
        const row = sql.getRow("SELECT * FROM note_revisions WHERE noteRevisionId = ?", [noteRevisionId]);

        return row ? new NoteRevision(row) : null;
    }

    getOption(name) {
        return this.options[name];
    }

    getEntity(entityName, entityId) {
        if (!entityName || !entityId) {
            return null;
        }

        const camelCaseEntityName = entityName.toLowerCase().replace(/(_[a-z])/g,
            group =>
                group
                    .toUpperCase()
                    .replace('_', '')
        );

        return this[camelCaseEntityName][entityId];
    }

    getRecentNotesFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        return rows.map(row => new RecentNote(row));
    }

    getNoteRevisionsFromQuery(query, params = []) {
        const rows = sql.getRows(query, params);

        return rows.map(row => new NoteRevision(row));
    }
}

const becca = new Becca();

module.exports = becca;
