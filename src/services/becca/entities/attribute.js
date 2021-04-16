"use strict";

const Note = require('./note.js');

class Attribute {
    constructor(becca, row) {
        /** @param {Becca} */
        this.becca = becca;
        /** @param {string} */
        this.attributeId = row.attributeId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.type = row.type;
        /** @param {string} */
        this.name = row.name;
        /** @param {int} */
        this.position = row.position;
        /** @param {string} */
        this.value = row.value;
        /** @param {boolean} */
        this.isInheritable = !!row.isInheritable;

        this.becca.attributes[this.attributeId] = this;

        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.becca.notes[this.noteId] = new Note(this.becca, {noteId: this.noteId});
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

    // for logging etc
    get pojo() {
        const pojo = {...this};

        delete pojo.becca;

        return pojo;
    }
}

module.exports = Attribute;
