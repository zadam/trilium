"use strict";

const Note = require('./note.js');
const AbstractEntity = require("./abstract_entity.js");
const sql = require("../../sql.js");
const dateUtils = require("../../date_utils.js");

class Branch extends AbstractEntity {
    static get entityName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "prefix"]; }

    constructor(row) {
        super();

        /** @param {string} */
        this.branchId = row.branchId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.parentNoteId = row.parentNoteId;
        /** @param {string} */
        this.prefix = row.prefix;
        /** @param {int} */
        this.notePosition = row.notePosition;
        /** @param {boolean} */
        this.isExpanded = !!row.isExpanded;

        if (this.branchId === 'root') {
            return;
        }

        const childNote = this.childNote;
        const parentNote = this.parentNote;

        childNote.parents.push(parentNote);
        childNote.parentBranches.push(this);

        parentNote.children.push(childNote);

        this.becca.branches[this.branchId] = this;
        this.becca.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get childNote() {
        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.notes[this.noteId] = new Note({noteId: this.noteId});
        }

        return this.becca.notes[this.noteId];
    }

    getNote() {
        return this.childNote;
    }

    /** @return {Note} */
    get parentNote() {
        if (!(this.parentNoteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.notes[this.parentNoteId] = new Note({noteId: this.parentNoteId});
        }

        return this.becca.notes[this.parentNoteId];
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
    }

    getPojo() {
        return {
            branchId: this.branchId,
            noteId: this.noteId,
            parentNoteId: this.parentNoteId,
            prefix: this.prefix,
            notePosition: this.notePosition,
            isExpanded: this.isExpanded,
            utcDateModified: this.utcDateModified,
            // not used for anything, will be later dropped
            utcDateCreated: dateUtils.utcNowDateTime()
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
