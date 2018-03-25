import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";

class TreeCache {
    load(noteRows, branchRows) {
        this.parents = [];
        this.children = [];
        this.childParentToBranch = {};

        /** @type {Object.<string, NoteShort>} */
        this.notes = {};
        for (const noteRow of noteRows) {
            const note = new NoteShort(this, noteRow);

            this.notes[note.noteId] = note;
        }

        /** @type {Object.<string, Branch>} */
        this.branches = {};
        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.addBranch(branch);
        }
    }

    /** @return NoteShort */
    async getNote(noteId) {
        return this.notes[noteId];
    }

    addBranch(branch) {
        this.branches[branch.branchId] = branch;

        this.parents[branch.noteId] = this.parents[branch.noteId] || [];
        this.parents[branch.noteId].push(this.notes[branch.parentNoteId]);

        this.children[branch.parentNoteId] = this.children[branch.parentNoteId] || [];
        this.children[branch.parentNoteId].push(this.notes[branch.noteId]);

        this.childParentToBranch[branch.noteId + '-' + branch.parentNoteId] = branch;
    }

    add(note, branch) {
        this.notes[note.noteId] = note;

        this.addBranch(branch);
    }

    /** @return Branch */
    async getBranch(branchId) {
        return this.branches[branchId];
    }

    /** @return Branch */
    async getBranchByChildParent(childNoteId, parentNoteId) {
        const key = (childNoteId + '-' + parentNoteId);
        const branch = this.childParentToBranch[key];

        if (!branch) {
            utils.throwError("Cannot find branch for child-parent=" + key);
        }

        return branch;
    }
}

const treeCache = new TreeCache();

export default treeCache;