"use strict";

const AbstractShacaEntity = require('./abstract_shaca_entity.js');

class SAttribute extends AbstractShacaEntity {
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
                const branch = this.shaca.getBranchFromChildAndParent(linkedChildNote.noteId, this.noteId);

                branch.isHidden = true;
            }
        }

        if (this.type === 'label' && this.name === 'shareAlias' && this.value.trim()) {
            this.shaca.aliasToNote[this.value.trim()] = this.note;
        }

        if (this.type === 'label' && this.name === 'shareRoot') {
            this.shaca.shareRootNote = this.note;
        }

        if (this.type === 'label' && this.name === 'shareIndex') {
            this.shaca.shareIndexEnabled = true;
        }
    }

    /** @returns {boolean} */
    get isAffectingSubtree() {
        return this.isInheritable
            || (this.type === 'relation' && ['template', 'inherit'].includes(this.name));
    }

    /** @returns {string} */
    get targetNoteId() { // alias
        return this.type === 'relation' ? this.value : undefined;
    }

    /** @returns {boolean} */
    isAutoLink() {
        return this.type === 'relation' && ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(this.name);
    }

    /** @returns {SNote} */
    get note() {
        return this.shaca.notes[this.noteId];
    }

    /** @returns {SNote|null} */
    get targetNote() {
        if (this.type === 'relation') {
            return this.shaca.notes[this.value];
        }
    }

    /** @returns {SNote|null} */
    getNote() {
        return this.shaca.getNote(this.noteId);
    }

    /** @returns {SNote|null} */
    getTargetNote() {
        if (this.type !== 'relation') {
            throw new Error(`Attribute '${this.attributeId}' is not relation`);
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

module.exports = SAttribute;
