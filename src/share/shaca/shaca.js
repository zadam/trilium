"use strict";

class Shaca {
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
        /** @type {Object.<String, String>} */
        this.aliasToNote = {};

        /** @type {Note|null} */
        this.shareRootNote = null;

        /** @type {boolean} true if the index of all shared subtrees is enabled */
        this.shareIndexEnabled = false;

        this.loaded = false;
    }

    /** @returns {Note|null} */
    getNote(noteId) {
        return this.notes[noteId];
    }

    /** @returns {boolean} */
    hasNote(noteId) {
        return noteId in this.notes;
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

    /** @returns {Branch|null} */
    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
    }

    /** @returns {Attribute|null} */
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
