class Link {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        /** @param {string} linkId */
        this.linkId = row.linkId;
        /** @param {string} noteId */
        this.noteId = row.noteId;
        /** @param {string} type */
        this.type = row.type;
        /** @param {string} targetNoteId */
        this.targetNoteId = row.targetNoteId;
        /** @param {string} utcDateCreated */
        this.utcDateCreated = row.utcDateCreated;
        /** @param {string} utcDateModified */
        this.utcDateModified = row.utcDateModified;
    }

    /** @returns {NoteShort} */
    async getNote() {
        return await this.treeCache.getNote(this.noteId);
    }

    /** @returns {NoteShort} */
    async getTargetNote() {
        return await this.treeCache.getNote(this.targetNoteId);
    }

    get toString() {
        return `Link(linkId=${this.linkId}, type=${this.type}, note=${this.noteId}, targetNoteId=${this.targetNoteId})`;
    }
}

export default Link;