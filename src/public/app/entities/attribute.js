class Attribute {
    constructor(treeCache, row) {
        this.treeCache = treeCache;

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
        this.isInheritable = row.isInheritable;
    }

    /** @returns {NoteShort} */
    getNote() {
        return this.treeCache.notes[this.noteId];
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

    /**
     * @return {boolean} - returns true if this attribute has the potential to influence the note in the argument.
     *         That can happen in multiple ways:
     *         1. attribute is owned by the note
     *         2. attribute is owned by the template of the note
     *         3. attribute is owned by some note's ancestor and is inheritable
     */
    isAffecting(affectedNote) {
        if (!affectedNote) {
            return false;
        }

        const attrNote = this.getNote();
        const owningNotes = [affectedNote, ...affectedNote.getTemplateNotes()];

        for (const owningNote of owningNotes) {
            if (owningNote.noteId === attrNote.noteId) {
                return true;
            }
        }

        if (this.isInheritable) {
            for (const owningNote of owningNotes) {
                if (owningNote.hasAncestor(attrNote)) {
                    return true;
                }
            }
        }

        return false;
    }

    isDefinition() {
        return this.type === 'label' && (this.name.startsWith('label:') || this.name.startsWith('relation:'));
    }

    getDefinition() {
        const tokens = this.value.split(',').map(t => t.trim());
        const defObj = {};

        for (const token of tokens) {
            if (token === 'promoted') {
                defObj.isPromoted = true;
            }
            else if (['text', 'number', 'boolean', 'date', 'url'].includes(token)) {
                defObj.labelType = token;
            }
            else if (['single', 'multi'].includes(token)) {
                defObj.multiplicity = token;
            }
            else if (token.startsWith('precision')) {
                const chunks = token.split('=');

                defObj.numberPrecision = parseInt(chunks[1]);
            }
            else if (token.startsWith('inverse')) {
                const chunks = token.split('=');

                defObj.inverseRelation = chunks[1];
            }
            else {
                console.log("Unrecognized attribute definition token:", token);
            }
        }

        return defObj;
    }
}

export default Attribute;
