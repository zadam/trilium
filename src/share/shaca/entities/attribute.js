"use strict";

const AbstractEntity = require('./abstract_entity');

class Attribute extends AbstractEntity {
    constructor([attributeId, noteId, type, name, value, isInheritable, position]) {
        super();

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

        this.shaca.attributes[this.attributeId] = this;
        this.shaca.notes[this.noteId].ownedAttributes.push(this);

        const targetNote = this.targetNote;

        if (targetNote) {
            targetNote.targetRelations.push(this);
        }

        if (this.type === 'relation' && this.name === 'imageLink') {
            const linkedChildNote = this.note.getChildNotes().find(childNote => childNote.noteId === this.value);

            if (linkedChildNote) {
                this.note.children = this.note.children.filter(childNote => childNote.noteId !== this.value);

                linkedChildNote.parents = linkedChildNote.parents.filter(parentNote => parentNote.noteId !== this.noteId);
            }
        }

        if (this.type === 'label' && this.name === 'shareAlias' && this.value.trim()) {
            this.shaca.aliasToNote[this.value.trim()] = this.note;
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
        return this.shaca.notes[this.noteId];
    }

    get targetNote() {
        if (this.type === 'relation') {
            return this.shaca.notes[this.value];
        }
    }

    /**
     * @returns {Note|null}
     */
    getNote() {
        return this.shaca.getNote(this.noteId);
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

        return this.shaca.getNote(this.value);
    }

    getPojo() {
        return {
            attributeId: this.attributeId,
            noteId: this.noteId,
            type: this.type,
            name: this.name,
            position: this.position,
            value: this.value,
            isInheritable: this.isInheritable
        };
    }
}

module.exports = Attribute;
