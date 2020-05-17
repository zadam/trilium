"use strict";

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

        if (this.branchId === 'root') {
            return;
        }

        const childNote = this.noteCache.notes[this.noteId];
        const parentNote = this.parentNote;

        if (!childNote) {
            console.log(`Cannot find child note ${this.noteId} of a branch ${this.branchId}`);
            return;
        }

        childNote.parents.push(parentNote);
        childNote.parentBranches.push(this);

        parentNote.children.push(childNote);

        this.noteCache.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get parentNote() {
        const note = this.noteCache.notes[this.parentNoteId];

        if (!note) {
            console.log(`Cannot find note ${this.parentNoteId}`);
        }

        return note;
    }
}

module.exports = Branch;
