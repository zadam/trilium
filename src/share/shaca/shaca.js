"use strict";

class Shaca {
    constructor() {
        this.reset();
    }

    reset() {
        /** @type {Object.<String, SNote>} */
        this.notes = {};
        /** @type {Object.<String, SBranch>} */
        this.branches = {};
        /** @type {Object.<String, SBranch>} */
        this.childParentToBranch = {};
        /** @type {Object.<String, SAttribute>} */
        this.attributes = {};
        /** @type {Object.<String, String>} */
        this.aliasToNote = {};

        /** @type {SNote|null} */
        this.shareRootNote = null;

        /** @type {boolean} true if the index of all shared subtrees is enabled */
        this.shareIndexEnabled = false;

        this.loaded = false;
    }

    /** @returns {SNote|null} */
    getNote(noteId) {
        return this.notes[noteId];
    }

    /** @returns {boolean} */
    hasNote(noteId) {
        return noteId in this.notes;
    }

    /** @returns {SNote[]} */
    getNotes(noteIds, ignoreMissing = false) {
        const filteredNotes = [];

        for (const noteId of noteIds) {
            const note = this.notes[noteId];

            if (!note) {
                if (ignoreMissing) {
                    continue;
                }

                throw new Error(`Note '${noteId}' was not found in shaca.`);
            }

            filteredNotes.push(note);
        }

        return filteredNotes;
    }

    /** @returns {SBranch|null} */
    getBranch(branchId) {
        return this.branches[branchId];
    }

    /** @returns {SBranch|null} */
    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }

    /** @returns {SAttribute|null} */
    getAttribute(attributeId) {
        return this.attributes[attributeId];
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
}

const shaca = new Shaca();

module.exports = shaca;
