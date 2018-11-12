import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import infoService from "./info.js";
import messagingService from "./messaging.js";
import server from "./server.js";

class TreeCache {
    constructor() {
        this.init();
    }

    load(noteRows, branchRows, relations) {
        this.init();

        this.addResp(noteRows, branchRows, relations);
    }

    init() {
        this.parents = {};
        this.children = {};
        this.childParentToBranch = {};

        /** @type {Object.<string, NoteShort>} */
        this.notes = {};

        /** @type {Object.<string, Branch>} */
        this.branches = {};
    }

    addResp(noteRows, branchRows, relations) {
        for (const noteRow of noteRows) {
            const note = new NoteShort(this, noteRow);

            this.notes[note.noteId] = note;
        }

        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.addBranch(branch);
        }

        for (const relation of relations) {
            this.addBranchRelationship(relation.branchId, relation.childNoteId, relation.parentNoteId);
        }
    }

    async getNotes(noteIds, silentNotFoundError = false) {
        const missingNoteIds = noteIds.filter(noteId => this.notes[noteId] === undefined);

        if (missingNoteIds.length > 0) {
            const resp = await server.post('tree/load', { noteIds: missingNoteIds });

            this.addResp(resp.notes, resp.branches, resp.relations);
        }

        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                messagingService.logError(`Can't find note "${noteId}"`);

                return null;
            }
            else {
                return this.notes[noteId];
            }
        }).filter(note => note !== null);
    }

    /** @return NoteShort */
    async getNote(noteId) {
        if (noteId === 'none') {
            return null;
        }

        return (await this.getNotes([noteId]))[0];
    }

    addBranch(branch) {
        this.branches[branch.branchId] = branch;

        this.addBranchRelationship(branch.branchId, branch.noteId, branch.parentNoteId);
    }

    addBranchRelationship(branchId, childNoteId, parentNoteId) {
        if (parentNoteId === 'none') { // applies only to root element
            return;
        }

        this.childParentToBranch[childNoteId + '-' + parentNoteId] = branchId;

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

    async getBranches(branchIds) {
        const missingBranchIds = branchIds.filter(branchId => this.branches[branchId] === undefined);

        if (missingBranchIds.length > 0) {
            const resp = await server.post('tree/load', { branchIds: branchIds });

            this.addResp(resp.notes, resp.branches, resp.relations);
        }

        return branchIds.map(branchId => {
            if (!this.branches[branchId]) {
                throw new Error(`Can't find branch ${branchId}`);
            }
            else {
                return this.branches[branchId];
            }
        });
    }

    /** @return Branch */
    async getBranch(branchId) {
        return (await this.getBranches([branchId]))[0];
    }

    /** @return Branch */
    async getBranchByChildParent(childNoteId, parentNoteId) {
        const branchId = this.getBranchIdByChildParent(childNoteId, parentNoteId);

        return await this.getBranch(branchId);
    }

    getBranchIdByChildParent(childNoteId, parentNoteId) {
        const key = childNoteId + '-' + parentNoteId;
        const branchId = this.childParentToBranch[key];

        if (!branchId) {
            infoService.throwError("Cannot find branch for child-parent=" + key);
        }

        return branchId;
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