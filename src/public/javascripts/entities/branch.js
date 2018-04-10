class Branch {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        this.branchId = row.branchId;
        this.noteId = row.noteId;
        this.note = null;
        this.parentNoteId = row.parentNoteId;
        this.notePosition = row.notePosition;
        this.prefix = row.prefix;
        this.isExpanded = row.isExpanded;
    }

    async getNote() {
        return await this.treeCache.getNote(this.noteId);
    }

    isTopLevel() {
        return this.parentNoteId === 'root';
    }

    get toString() {
        return `Branch(branchId=${this.branchId})`;
    }
}

export default Branch;