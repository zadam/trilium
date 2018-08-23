/**
 * This note's representation is used in note tree and is kept in TreeCache.
 * Its notable omission is the note content.
 */
class NoteShort {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.title = row.title;
        /** @param {boolean} */
        this.isProtected = row.isProtected;
        /** @param {string} one of 'text', 'code', 'file' or 'render' */
        this.type = row.type;
        /** @param {string} content-type, e.g. "application/json" */
        this.mime = row.mime;
        /** @param {boolean} */
        this.archived = row.archived;
        this.cssClass = row.cssClass;
    }

    /** @returns {boolean} */
    isJson() {
        return this.mime === "application/json";
    }

    /** @returns {Promise<Array.<Branch>>} */
    async getBranches() {
        const branchIds = this.treeCache.parents[this.noteId].map(
            parentNoteId => this.treeCache.getBranchIdByChildParent(this.noteId, parentNoteId));

        return this.treeCache.getBranches(branchIds);
    }

    /** @returns {boolean} */
    hasChildren() {
        return this.treeCache.children[this.noteId]
            && this.treeCache.children[this.noteId].length > 0;
    }

    /** @returns {Promise<Array.<Branch>>} */
    async getChildBranches() {
        if (!this.treeCache.children[this.noteId]) {
            return [];
        }

        const branchIds = this.treeCache.children[this.noteId].map(
            childNoteId => this.treeCache.getBranchIdByChildParent(childNoteId, this.noteId));

        return await this.treeCache.getBranches(branchIds);
    }

    /** @returns {Array.<string>} */
    getParentNoteIds() {
        return this.treeCache.parents[this.noteId] || [];
    }

    /** @returns {Promise<Array.<NoteShort>>} */
    async getParentNotes() {
        return await this.treeCache.getNotes(this.getParentNoteIds());
    }

    /** @returns {Array.<string>} */
    getChildNoteIds() {
        return this.treeCache.children[this.noteId] || [];
    }

    /** @returns {Promise<Array.<NoteShort>>} */
    async getChildNotes() {
        return await this.treeCache.getNotes(this.getChildNoteIds());
    }

    get toString() {
        return `Note(noteId=${this.noteId}, title=${this.title})`;
    }

    get dto() {
        const dto = Object.assign({}, this);
        delete dto.treeCache;
        delete dto.archived;

        return dto;
    }
}

export default NoteShort;