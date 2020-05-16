class Attribute {
    constructor(row) {
        /** @param {string} */
        this.attributeId = row.attributeId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.type = row.type;
        /** @param {string} */
        this.name = row.name;
        /** @param {string} */
        this.value = row.value;
        /** @param {boolean} */
        this.isInheritable = !!row.isInheritable;

        notes[this.noteId].ownedAttributes.push(this);

        const key = `${this.type-this.name}`;
        attributeIndex[key] = attributeIndex[key] || [];
        attributeIndex[key].push(this);

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
        return notes[this.noteId];
    }

    get targetNote() {
        if (this.type === 'relation') {
            return notes[this.value];
        }
    }
}
