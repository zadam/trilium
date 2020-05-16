export default class Branch {
    constructor(row) {
        /** @param {string} */
        this.branchId = row.branchId;
        /** @param {string} */
        this.noteId = row.noteId;
        /** @param {string} */
        this.parentNoteId = row.parentNoteId;
        /** @param {string} */
        this.prefix = row.prefix;

        if (this.branchId === 'root') {
            return;
        }

        const childNote = notes[this.noteId];
        const parentNote = this.parentNote;

        if (!childNote) {
            console.log(`Cannot find child note ${this.noteId} of a branch ${this.branchId}`);
            return;
        }

        childNote.parents.push(parentNote);
        childNote.parentBranches.push(this);

        parentNote.children.push(childNote);

        childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;
    }

    /** @return {Note} */
    get parentNote() {
        const note = notes[this.parentNoteId];

        if (!note) {
            console.log(`Cannot find note ${this.parentNoteId}`);
        }

        return note;
    }
}
