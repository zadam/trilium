"use strict";

const Note = require('./note.js');
const sql = require("../sql.js");

class Attribute {
    constructor(row) {
        this.updateFromRow(row);
        this.init();
    }

    updateFromRow(row) {
        this.update([
            row.attributeId,
            row.noteId,
            row.type,
            row.name,
            row.value,
            row.isInheritable,
            row.position
        ]);
    }

    update([attributeId, noteId, type, name, value, isInheritable, position]) {
        /** @param {string} */
        this.attributeId = attributeId;
        /** @param {string} */
        this.noteId = noteId;
        /** @param {string} */
        this.type = type;
        /** @param {string} */
        this.name = name;
        /** @param {int} */
        this.position = position;
        /** @param {string} */
        this.value = value;
        /** @param {boolean} */
        this.isInheritable = !!isInheritable;

        return this;
    }

    init() {
        if (this.attributeId) {
            this.becca.attributes[this.attributeId] = this;
        }

        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.addNote(this.noteId, new Note({noteId: this.noteId}));
        }

        this.becca.notes[this.noteId].ownedAttributes.push(this);

        const key = `${this.type}-${this.name.toLowerCase()}`;
        this.becca.attributeIndex[key] = this.becca.attributeIndex[key] || [];
        this.becca.attributeIndex[key].push(this);

        const targetNote = this.targetNote;

        if (targetNote) {
            targetNote.targetRelations.push(this);
        }
    }

    get isAffectingSubtree() {
        return this.isInheritable
            || (this.type === 'relation' && this.name === 'template');
    }

    get targetNoteId() { // alias
        return this.type === 'relation' ? this.value : undefined;
    }

    isAutoLink() {
        return this.type === 'relation' && ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(this.name);
    }

    get note() {
        return this.becca.notes[this.noteId];
    }

    get targetNote() {
        if (this.type === 'relation') {
            return this.becca.notes[this.value];
        }
    }

    /**
     * @returns {Note|null}
     */
    getNote() {
        return this.becca.getNote(this.noteId);
    }

    /**
     * @returns {Note|null}
     */
    getTargetNote() {
        if (this.type !== 'relation') {
            throw new Error(`Attribute ${this.attributeId} is not relation`);
        }

        if (!this.value) {
            return null;
        }

        return this.becca.getNote(this.value);
    }
}

module.exports = Attribute;
