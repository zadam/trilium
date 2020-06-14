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

    get jsonValue() {
        try {
            return JSON.parse(this.value);
        }
        catch (e) {
            return null;
        }
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
}

export default Attribute;
