class NoteShort {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        this.noteId = row.noteId;
        this.title = row.title;
        this.isProtected = row.isProtected;
        this.type = row.type;
        this.mime = row.mime;
        this.hideInAutocomplete = row.hideInAutocomplete;
    }

    isJson() {
        return this.mime === "application/json";
    }

    async getBranches() {
        const branchIds = this.treeCache.parents[this.noteId].map(
            parentNoteId => this.treeCache.getBranchIdByChildParent(this.noteId, parentNoteId));

        return this.treeCache.getBranches(branchIds);
    }

    hasChildren() {
        return this.treeCache.children[this.noteId]
            && this.treeCache.children[this.noteId].length > 0;
    }

    async getChildBranches() {
        if (!this.treeCache.children[this.noteId]) {
            return [];
        }

        const branchIds = this.treeCache.children[this.noteId].map(
            childNoteId => this.treeCache.getBranchIdByChildParent(childNoteId, this.noteId));

        return await this.treeCache.getBranches(branchIds);
    }

    getParentNoteIds() {
        return this.treeCache.parents[this.noteId] || [];
    }

    async getParentNotes() {
        return await this.treeCache.getNotes(this.getParentNoteIds());
    }

    getChildNoteIds() {
        return this.treeCache.children[this.noteId] || [];
    }

    async getChildNotes() {
        return await this.treeCache.getNotes(this.getChildNoteIds());
    }

    get toString() {
        return `Note(noteId=${this.noteId}, title=${this.title})`;
    }

    get dto() {
        const dto = Object.assign({}, this);
        delete dto.treeCache;
        delete dto.hideInAutocomplete;

        return dto;
    }
}

export default NoteShort;