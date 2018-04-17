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

        for (const parentNoteId of this.treeCache.parents[this.noteId]) {
            branches.push(await this.treeCache.getBranchByChildParent(this.noteId, parentNoteId));
        }

        return branches;
    }

    hasChildren() {
        return this.treeCache.children[this.noteId]
            && this.treeCache.children[this.noteId].length > 0;
    }

    async getChildBranches() {
        if (!this.treeCache.children[this.noteId]) {
            return [];
        }

        const branches = [];

        for (const childNoteId of this.treeCache.children[this.noteId]) {
            branches.push(await this.treeCache.getBranchByChildParent(childNoteId, this.noteId));
        }

        return branches;
    }

    async __getNotes(noteIds) {
        if (!noteIds) {
            return [];
        }

        const notes = [];

        for (const noteId of noteIds) {
            notes.push(await this.treeCache.getNote(noteId));
        }

        return notes;
    }

    async getParentNotes() {
        return this.__getNotes(this.treeCache.parents[this.noteId]);
    }

    async getChildNotes() {
        return this.__getNotes(this.treeCache.children[this.noteId]);
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