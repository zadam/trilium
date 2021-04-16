"use strict";

const Note = require('./note.js');

class Branch {
    constructor(becca, row) {
        /** @param {Becca} */
        this.becca = becca;
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
            this.becca.notes[this.noteId] = new Note(this.becca, {noteId: this.noteId});
        }

        return this.becca.notes[this.noteId];
    }

    /** @return {Note} */
    get parentNote() {
        if (!(this.parentNoteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.notes[this.parentNoteId] = new Note(this.becca, {noteId: this.parentNoteId});
        }

        return this.becca.notes[this.parentNoteId];
    }

    // for logging etc
    get pojo() {
        const pojo = {...this};

        delete pojo.becca;

        return pojo;
    }
}

module.exports = Branch;
