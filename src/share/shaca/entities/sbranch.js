"use strict";

const AbstractShacaEntity = require('./abstract_shaca_entity');

class SBranch extends AbstractShacaEntity {
    constructor([branchId, noteId, parentNoteId, prefix, isExpanded]) {
        super();

        /** @param {string} */
        this.branchId = branchId;
        /** @param {string} */
        this.noteId = noteId;
        /** @param {string} */
        this.parentNoteId = parentNoteId;
        /** @param {string} */
        this.prefix = prefix;
        /** @param {boolean} */
        this.isExpanded = !!isExpanded;
        /** @param {boolean} */
        this.isHidden = false;

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

        this.shaca.branches[this.branchId] = this;
        this.shaca.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @returns {SNote} */
    get childNote() {
        return this.shaca.notes[this.noteId];
    }

    /** @returns {SNote} */
    getNote() {
        return this.childNote;
    }

    /** @returns {SNote} */
    get parentNote() {
        return this.shaca.notes[this.parentNoteId];
    }
}

module.exports = SBranch;
