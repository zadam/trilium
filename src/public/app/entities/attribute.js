import promotedAttributeDefinitionParser from '../services/promoted_attribute_definition_parser.js';

class Attribute {
    constructor(froca, row) {
        this.froca = froca;

        this.update(row);
    }

    update(row) {
        /** @param {string} attributeId */
        this.attributeId = row.attributeId;
        /** @param {string} noteId */
        this.noteId = row.noteId;
        /** @param {string} type */
        this.type = row.type;
        /** @param {string} name */
        this.name = row.name;
        /** @param {string} value */
        this.value = row.value;
        /** @param {int} position */
        this.position = row.position;
        /** @param {boolean} isInheritable */
        this.isInheritable = !!row.isInheritable;
    }

    /** @returns {NoteShort} */
    getNote() {
        return this.froca.notes[this.noteId];
    }

    get targetNoteId() { // alias
        return this.type === 'relation' ? this.value : undefined;
    }

    get isAutoLink() {
        return this.type === 'relation' && ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(this.name);
    }

    get toString() {
        return `Attribute(attributeId=${this.attributeId}, type=${this.type}, name=${this.name}, value=${this.value})`;
    }

    isDefinition() {
        return this.type === 'label' && (this.name.startsWith('label:') || this.name.startsWith('relation:'));
    }

    getDefinition() {
        return promotedAttributeDefinitionParser.parse(this.value);
    }

    isDefinitionFor(attr) {
        return this.type === 'label' && this.name === `${attr.type}:${attr.name}`;
    }

    get dto() {
        const dto = Object.assign({}, this);
        delete dto.froca;

        return dto;
    }
}

export default Attribute;
