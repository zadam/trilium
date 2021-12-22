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

        this.loaded = false;
    }

    getNote(noteId) {
        return this.notes[noteId];
    }

    hasNote(noteId) {
        return noteId in this.notes;
    }

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

    getBranch(branchId) {
        return this.branches[branchId];
    }

    getAttribute(attributeId) {
        return this.attributes[attributeId];
    }

    getBranchFromChildAndParent(childNoteId, parentNoteId) {
        return this.childParentToBranch[`${childNoteId}-${parentNoteId}`];
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
