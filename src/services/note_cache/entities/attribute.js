"use strict";

const Note = require('./note.js');

class Attribute {
    constructor(noteCache, row) {
        /** @param {NoteCache} */
        this.noteCache = noteCache;
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

        if (typeof row.value !== 'string') {
            row.value = JSON.stringify(row.value);
        }

        /** @param {string} */
        this.value = row.value;
        /** @param {boolean} */
        this.isInheritable = !!row.isInheritable;

        this.noteCache.attributes[this.attributeId] = this;

        if (!(this.noteId in this.noteCache.notes)) {
            // entities can come out of order in sync, create skeleton which will be filled later
            this.noteCache.notes[this.noteId] = new Note(this.noteCache, {noteId: this.noteId});
        }

        this.noteCache.notes[this.noteId].ownedAttributes.push(this);

        const key = `${this.type}-${this.name}`;
        this.noteCache.attributeIndex[key] = this.noteCache.attributeIndex[key] || [];
        this.noteCache.attributeIndex[key].push(this);

        const targetNote = this.targetNote;

        if (targetNote) {
            targetNote.targetRelations.push(this);
        }
    }

    get isAffectingSubtree() {
        return this.isInheritable
            || (this.type === 'relation' && this.name === 'template');
    }

    get note() {
        return this.noteCache.notes[this.noteId];
    }

    get targetNote() {
        if (this.type === 'relation') {
            return this.noteCache.notes[this.value];
        }
    }
}

module.exports = Attribute;
