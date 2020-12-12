"use strict";

const Note = require('./note.js');

class Branch {
    constructor(noteCache, row) {
        /** @param {NoteCache} */
        this.noteCache = noteCache;
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

        this.noteCache.branches[this.branchId] = this;
        this.noteCache.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get childNote() {
        if (!(this.noteId in this.noteCache.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.noteCache.notes[this.noteId] = new Note(this.noteCache, {noteId: this.noteId});
        }

        return this.noteCache.notes[this.noteId];
    }

    /** @return {Note} */
    get parentNote() {
        if (!(this.parentNoteId in this.noteCache.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.noteCache.notes[this.parentNoteId] = new Note(this.noteCache, {noteId: this.parentNoteId});
        }

        return this.noteCache.notes[this.parentNoteId];
    }
}

module.exports = Branch;
