"use strict";

const Note = require('./note.js');
const sql = require("../sql.js");

class Branch {
    constructor(row) {
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

    update([branchId, noteId, parentNoteId, prefix, notePosition, isExpanded]) {
        /** @param {string} */
        this.branchId = branchId;
        /** @param {string} */
        this.noteId = noteId;
        /** @param {string} */
        this.parentNoteId = parentNoteId;
        /** @param {string} */
        this.prefix = prefix;
        /** @param {int} */
        this.notePosition = notePosition;
        /** @param {boolean} */
        this.isExpanded = !!isExpanded;

        return this;
    }

    init() {
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

        this.becca.branches[this.branchId] = this;
        this.becca.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get childNote() {
        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.addNote(this.noteId, new Note({noteId: this.noteId}));
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
            this.becca.addNote(this.parentNoteId, new Note({noteId: this.parentNoteId}));
        }

        return this.becca.notes[this.parentNoteId];
    }
}

module.exports = Branch;
