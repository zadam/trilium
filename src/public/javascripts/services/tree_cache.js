import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import infoService from "./info.js";
import messagingService from "./messaging.js";
import server from "./server.js";

/**
 * TreeCache keeps a read only cache of note tree structure in frontend's memory.
 */
class TreeCache {
    constructor() {
        this.init();
    }

    load(noteRows, branchRows, relations) {
        this.init();

        this.addResp(noteRows, branchRows, relations);
    }

    init() {
        /** @type {Object.<string, string>} */
        this.parents = {};
        /** @type {Object.<string, string>} */
        this.children = {};

        /** @type {Object.<string, string>} */
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

    /**
     * Reload children of given noteId.
     */
    async reloadChildren(noteId) {
        const resp = await server.post('tree/load', { noteIds: [noteId] });

        for (const childNoteId of this.children[noteId] || []) {
            this.parents[childNoteId] = this.parents[childNoteId].filter(p => p !== noteId);

            const branchId = this.getBranchIdByChildParent(childNoteId, noteId);

            delete this.branches[branchId];
            delete this.childParentToBranch[childNoteId + '-' + noteId];
        }

        this.children[noteId] = [];

        delete this.notes[noteId];

        this.addResp(resp.notes, resp.branches, resp.relations);
    }

    /**
     * Reloads parents of given noteId - useful when new note is created to make sure note is loaded
     * in a correct order.
     */
    async reloadParents(noteId) {
        // to be able to find parents we need first to make sure it is actually loaded
        await this.getNote(noteId);

        for (const parentNoteId of this.parents[noteId] || []) {
            await this.reloadChildren(parentNoteId);
        }

        // this is done to load the new parents for the noteId
        await this.reloadChildren(noteId);
    }

    /** @return {Promise<NoteShort[]>} */
    async getNotes(noteIds, silentNotFoundError = false) {
        const missingNoteIds = noteIds.filter(noteId => this.notes[noteId] === undefined);

        if (missingNoteIds.length > 0) {
            const resp = await server.post('tree/load', { noteIds: missingNoteIds });

            this.addResp(resp.notes, resp.branches, resp.relations);

            for (const note of resp.notes) {
                await this.reloadParents(note.noteId);
            }
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

    /** @return {Promise<boolean>} */
    async noteExists(noteId) {
        const notes = await this.getNotes([noteId], true);

        return notes.length === 1;
    }

    /** @return {Promise<NoteShort>} */
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
    async moveNote(childNoteId, oldParentNoteId, newParentNoteId, beforeNoteId, afterNoteId) {
        utils.assertArguments(childNoteId, oldParentNoteId, newParentNoteId);

        if (oldParentNoteId === newParentNoteId) {
            return;
        }

        const branchId = this.childParentToBranch[childNoteId + '-' + oldParentNoteId];
        const branch = await this.getBranch(branchId);
        branch.parentNoteId = newParentNoteId;

        this.childParentToBranch[childNoteId + '-' + newParentNoteId] = branchId;
        delete this.childParentToBranch[childNoteId + '-' + oldParentNoteId]; // this is correct because we know that oldParentId isn't same as newParentId

        // remove old associations
        this.parents[childNoteId] = this.parents[childNoteId].filter(p => p !== oldParentNoteId);
        this.children[oldParentNoteId] = this.children[oldParentNoteId].filter(ch => ch !== childNoteId);

        // add new associations
        this.parents[childNoteId].push(newParentNoteId);

        const children = this.children[newParentNoteId] = this.children[newParentNoteId] || []; // this might be first child

        // we try to put the note into precise order which might be used again by lazy-loaded nodes
        if (beforeNoteId && children.includes(beforeNoteId)) {
            children.splice(children.indexOf(beforeNoteId), 0, childNoteId);
        }
        else if (afterNoteId && children.includes(afterNoteId)) {
            children.splice(children.indexOf(afterNoteId) + 1, 0, childNoteId);
        }
        else {
            children.push(childNoteId);
        }
    }
}

const treeCache = new TreeCache();

export default treeCache;