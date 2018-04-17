import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import infoService from "./info.js";
import server from "./server.js";

class TreeCache {
    load(noteRows, branchRows, parentToChildren) {
        this.parents = {};
        this.children = {};
        this.childParentToBranch = {};

        /** @type {Object.<string, NoteShort>} */
        this.notes = {};

        /** @type {Object.<string, Branch>} */
        this.branches = {};

        this.addResp(noteRows, branchRows, parentToChildren);
    }

    addResp(noteRows, branchRows, parentToChildren) {
        for (const noteRow of noteRows) {
            const note = new NoteShort(this, noteRow);

            this.notes[note.noteId] = note;
        }

        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.addBranch(branch);
        }

        for (const relation of parentToChildren) {
            this.addBranchRelationship(relation.branchId, relation.childNoteId, relation.parentNoteId);
        }
    }

    /** @return NoteShort */
    async getNote(noteId) {
        if (this.notes[noteId] === undefined) {
            const resp = await server.post('tree/load', {
                noteIds: [noteId]
            });

            this.addResp(resp.notes, resp.branches, resp.parentToChildren);
        }

        if (!this.notes[noteId]) {
            throw new Error(`Can't find note ${noteId}`);
        }

        return this.notes[noteId];
    }

    addBranch(branch) {
        this.branches[branch.branchId] = branch;

        this.addBranchRelationship(branch.branchId, branch.noteId, branch.parentNoteId);
    }

    addBranchRelationship(branchId, childNoteId, parentNoteId) {
        this.addParentChildRelationship(parentNoteId, childNoteId);

        this.childParentToBranch[childNoteId + '-' + parentNoteId] = branchId;
    }

    addParentChildRelationship(parentNoteId, childNoteId) {
        this.parents[childNoteId] = this.parents[childNoteId] || [];

        if (!this.parents[childNoteId].includes(parentNoteId)) {
            this.parents[childNoteId].push(parentNoteId);
        }

        this.children[parentNoteId] = this.children[parentNoteId] || [];

        if (!this.children[parentNoteId].includes(childNoteId)) {
            this.children[parentNoteId].push(childNoteId);
        }
    }

    add(note, branch) {
        this.notes[note.noteId] = note;

        this.addBranch(branch);
    }

    /** @return Branch */
    async getBranch(branchId) {
        if (this.branches[branchId] === undefined) {
            const resp = await server.post('tree/load', {
                branchIds: [branchId]
            });

            this.addResp(resp.notes, resp.branches, resp.parentToChildren);
        }

        if (!this.branches[branchId]) {
            throw new Error(`Can't find branch ${branchId}`);
        }

        return this.branches[branchId];
    }

    /** @return Branch */
    async getBranchByChildParent(childNoteId, parentNoteId) {
        // this will make sure the note and its relationships are loaded
        await this.getNote(parentNoteId);

        const key = (childNoteId + '-' + parentNoteId);
        const branchId = this.childParentToBranch[key];

        if (!branchId) {
            infoService.throwError("Cannot find branch for child-parent=" + key);
        }

        return await this.getBranch(branchId);
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
        treeCache.parents[childNoteId] = treeCache.parents[childNoteId].filter(p => p !== oldParentNoteId);
        treeCache.children[oldParentNoteId] = treeCache.children[oldParentNoteId].filter(ch => ch !== childNoteId);

        // add new associations
        treeCache.parents[childNoteId].push(newParentNoteId);

        treeCache.children[newParentNoteId] = treeCache.children[newParentNoteId] || []; // this might be first child
        treeCache.children[newParentNoteId].push(childNoteId);
    }
}

const treeCache = new TreeCache();

export default treeCache;