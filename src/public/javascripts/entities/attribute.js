class Attribute {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
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
        /** @param {boolean} isDeleted */
        this.isDeleted = row.isDeleted;
        /** @param {string} utcDateCreated */
        this.utcDateCreated = row.utcDateCreated;
        /** @param {string} utcDateModified */
        this.utcDateModified = row.utcDateModified;
    }

    /** @returns {NoteShort} */
    async getNote() {
        return await this.treeCache.getNote(this.noteId);
    }

    get toString() {
        return `Attribute(attributeId=${this.attributeId}, type=${this.type}, name=${this.name})`;
    }
}

export default Attribute;