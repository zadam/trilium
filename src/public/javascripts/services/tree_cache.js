import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import infoService from "./info.js";

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
            infoService.throwError("Cannot find branch for child-parent=" + key);
        }

        return branch;
    }

    /* Move note from one parent to another. */
    async moveNote(childNoteId, oldParentNoteId, newParentNoteId) {
        utils.assertArguments(childNoteId, oldParentNoteId, newParentNoteId);

        if (oldParentNoteId === newParentNoteId) {
            return;
        }

        treeCache.childParentToBranch[childNoteId + '-' + newParentNoteId] = treeCache.childParentToBranch[childNoteId + '-' + oldParentNoteId];
        delete treeCache.childParentToBranch[childNoteId + '-' + oldParentNoteId]; // this is correct because we know that oldParentId isn't same as newParentId

        // remove old associations
        treeCache.parents[childNoteId] = treeCache.parents[childNoteId].filter(p => p.noteId !== oldParentNoteId);
        treeCache.children[oldParentNoteId] = treeCache.children[oldParentNoteId].filter(ch => ch.noteId !== childNoteId);

        // add new associations
        treeCache.parents[childNoteId].push(await treeCache.getNote(newParentNoteId));

        treeCache.children[newParentNoteId] = treeCache.children[newParentNoteId] || []; // this might be first child
        treeCache.children[newParentNoteId].push(await treeCache.getNote(childNoteId));
    }

    removeParentChildRelation(parentNoteId, childNoteId) {
        utils.assertArguments(parentNoteId, childNoteId);

        treeCache.parents[childNoteId] = treeCache.parents[childNoteId].filter(p => p.noteId !== parentNoteId);
        treeCache.children[parentNoteId] = treeCache.children[parentNoteId].filter(ch => ch.noteId !== childNoteId);

        delete treeCache.childParentToBranch[childNoteId + '-' + parentNoteId];
    }

    async setParentChildRelation(branchId, parentNoteId, childNoteId) {
        treeCache.parents[childNoteId] = treeCache.parents[childNoteId] || [];
        treeCache.parents[childNoteId].push(await treeCache.getNote(parentNoteId));

        treeCache.children[parentNoteId] = treeCache.children[parentNoteId] || [];
        treeCache.children[parentNoteId].push(await treeCache.getNote(childNoteId));

        treeCache.childParentToBranch[childNoteId + '-' + parentNoteId] = await treeCache.getBranch(branchId);
    }
}

const treeCache = new TreeCache();

export default treeCache;