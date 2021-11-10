import promotedAttributeDefinitionParser from '../services/promoted_attribute_definition_parser.js';

/**
 * Attribute is an abstract concept which has two real uses - label (key - value pair)
 * and relation (representing named relationship between source and target note)
 */
class Attribute {
    constructor(froca, row) {
        this.froca = froca;

        this.update(row);
    }

    update(row) {
        /** @type {string} */
        this.attributeId = row.attributeId;
        /** @type {string} */
        this.noteId = row.noteId;
        /** @type {string} */
        this.type = row.type;
        /** @type {string} */
        this.name = row.name;
        /** @type {string} */
        this.value = row.value;
        /** @type {int} */
        this.position = row.position;
        /** @type {boolean} */
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
