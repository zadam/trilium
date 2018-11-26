/** Represents mapping between note and parent note */
class Branch {
    constructor(treeCache, row) {
        this.treeCache = treeCache;
        /** @param {string} primary key */
        this.branchId = row.branchId;
        /** @param {string} */
        this.noteId = row.noteId;
        this.note = null;
        /** @param {string} */
        this.parentNoteId = row.parentNoteId;
        /** @param {int} */
        this.notePosition = row.notePosition;
        /** @param {string} */
        this.prefix = row.prefix;
        /** @param {boolean} */
        this.isExpanded = !!row.isExpanded;
    }

    /** @returns {NoteShort} */
    async getNote() {
        return await this.treeCache.getNote(this.noteId);
    }

    /** @returns {boolean} true if it's top level, meaning its parent is root note */
    isTopLevel() {
        return this.parentNoteId === 'root';
    }

    get toString() {
        return `Branch(branchId=${this.branchId})`;
    }
}

export default Branch;