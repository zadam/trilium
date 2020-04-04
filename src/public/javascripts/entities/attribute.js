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
    async getNote() {
        return await this.treeCache.getNote(this.noteId);
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
}

export default Attribute;