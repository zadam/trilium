"use strict";

const Note = require('./note.js');
const AbstractEntity = require("./abstract_entity.js");
const sql = require("../../services/sql.js");
const dateUtils = require("../../services/date_utils.js");

/**
 * Branch represents a relationship between a child note and its parent note. Trilium allows a note to have multiple
 * parents.
 */
class Branch extends AbstractEntity {
    static get entityName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "prefix"]; }

    constructor(row) {
        super();

        if (!row) {
            return;
        }

        this.updateFromRow(row);
        this.init();
    }

    updateFromRow(row) {
        this.update([
            row.branchId,
            row.noteId,
            row.parentNoteId,
            row.prefix,
            row.notePosition,
            row.isExpanded,
            row.utcDateModified
        ]);
    }

    update([branchId, noteId, parentNoteId, prefix, notePosition, isExpanded, utcDateModified]) {
        /** @type {string} */
        this.branchId = branchId;
        /** @type {string} */
        this.noteId = noteId;
        /** @type {string} */
        this.parentNoteId = parentNoteId;
        /** @type {string} */
        this.prefix = prefix;
        /** @type {int} */
        this.notePosition = notePosition;
        /** @type {boolean} */
        this.isExpanded = !!isExpanded;
        /** @type {string} */
        this.utcDateModified = utcDateModified;

        return this;
    }

    init() {
        if (this.branchId) {
            this.becca.branches[this.branchId] = this;
        }

        this.becca.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;

        if (this.branchId === 'root') {
            return;
        }

        const childNote = this.childNote;
        const parentNote = this.parentNote;

        if (!childNote.parents.includes(parentNote)) {
            childNote.parents.push(parentNote);
        }

        if (!childNote.parentBranches.includes(this)) {
            childNote.parentBranches.push(this);
        }

        if (!parentNote.children.includes(childNote)) {
            parentNote.children.push(childNote);
        }
    }

    /** @returns {Note} */
    get childNote() {
        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.noteId, new Note({noteId: this.noteId}));
        }

        return this.becca.notes[this.noteId];
    }

    getNote() {
        return this.childNote;
    }

    /** @returns {Note} */
    get parentNote() {
        if (!(this.parentNoteId in this.becca.notes)) {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.parentNoteId, new Note({noteId: this.parentNoteId}));
        }

        return this.becca.notes[this.parentNoteId];
    }

    get isDeleted() {
        return !(this.branchId in this.becca.branches);
    }

    beforeSaving() {
        if (this.notePosition === undefined || this.notePosition === null) {
            // TODO finding new position can be refactored into becca
            const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [this.parentNoteId]);
            this.notePosition = maxNotePos === null ? 0 : maxNotePos + 10;
        }

        if (!this.isExpanded) {
            this.isExpanded = false;
        }

        this.utcDateModified = dateUtils.utcNowDateTime();

        super.beforeSaving();

        this.becca.branches[this.branchId] = this;
    }

    getPojo() {
        return {
            branchId: this.branchId,
            noteId: this.noteId,
            parentNoteId: this.parentNoteId,
            prefix: this.prefix,
            notePosition: this.notePosition,
            isExpanded: this.isExpanded,
            isDeleted: false,
            utcDateModified: this.utcDateModified
        };
    }

    createClone(parentNoteId, notePosition) {
        return new Branch({
            noteId: this.noteId,
            parentNoteId: parentNoteId,
            notePosition: notePosition,
            prefix: this.prefix,
            isExpanded: this.isExpanded
        });
    }
}

module.exports = Branch;
