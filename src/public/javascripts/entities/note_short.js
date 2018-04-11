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
        const branches = [];

        for (const parent of this.treeCache.parents[this.noteId]) {
            branches.push(await this.treeCache.getBranchByChildParent(this.noteId, parent.noteId));
        }

        return branches;
    }

    async getChildBranches() {
        if (!this.treeCache.children[this.noteId]) {
            return [];
        }

        const branches = [];

        for (const child of this.treeCache.children[this.noteId]) {
            branches.push(await this.treeCache.getBranchByChildParent(child.noteId, this.noteId));
        }

        return branches;
    }

    async getParentNotes() {
        return this.treeCache.parents[this.noteId] || [];
    }

    async getChildNotes() {
        return this.treeCache.children[this.noteId] || [];
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