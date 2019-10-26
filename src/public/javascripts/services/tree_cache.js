import utils from "./utils.js";
import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import ws from "./ws.js";
import server from "./server.js";

/**
 * TreeCache keeps a read only cache of note tree structure in frontend's memory.
 */
class TreeCache {
    constructor() {
        this.init();
    }

    init() {
        /** @type {Object.<string, NoteShort>} */
        this.notes = {};

        /** @type {Object.<string, Branch>} */
        this.branches = {};
    }

    load(noteRows, branchRows) {
        this.init();

        this.addResp(noteRows, branchRows);
    }

    addResp(noteRows, branchRows) {
        const branchesByNotes = {};

        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.addBranch(branch);

            branchesByNotes[branch.noteId] = branchesByNotes[branch.noteId] || [];
            branchesByNotes[branch.noteId].push(branch);

            branchesByNotes[branch.parentNoteId] = branchesByNotes[branch.parentNoteId] || [];
            branchesByNotes[branch.parentNoteId].push(branch);
        }

        for (const noteRow of noteRows) {
            const {noteId} = noteRow;

            const oldNote = this.notes[noteId];

            if (oldNote) {
                for (const childNoteId of oldNote.children) {
                    const childNote = this.notes[childNoteId];

                    if (childNote) {
                        childNote.parents = childNote.parents.filter(p => p !== noteId);

                        const branchId = childNote.parentToBranch[noteId];

                        if (branchId in this.branches) {
                            delete this.branches[branchId];
                        }

                        delete childNote.parentToBranch[noteId];
                    }
                }

                for (const parentNoteId of oldNote.parents) {
                    const parentNote = this.notes[parentNoteId];

                    if (parentNote) {
                        parentNote.children = parentNote.children.filter(p => p !== noteId);

                        const branchId = parentNote.childToBranch[noteId];

                        if (branchId in this.branches) {
                            delete this.branches[branchId];
                        }

                        delete parentNote.childToBranch[noteId];
                    }
                }
            }

            const note = new NoteShort(this, noteRow, branchesByNotes[noteId]);

            this.notes[note.noteId] = note;

            for (const childNoteId of note.children) {
                const childNote = this.notes[childNoteId];

                if (childNote) {
                    childNote.addParent(noteId, note.childToBranch[childNoteId]);
                }
            }

            for (const parentNoteId of note.parents) {
                const parentNote = this.notes[parentNoteId];

                if (parentNote) {
                    parentNote.addChild(noteId, note.parentToBranch[parentNoteId]);
                }
            }
        }
    }

    async reloadNotes(noteIds) {
        // first load the data before clearing the cache
        const resp = await server.post('tree/load', { noteIds });

        this.addResp(resp.notes, resp.branches);
    }

    /** @return {Promise<NoteShort[]>} */
    async getNotes(noteIds, silentNotFoundError = false) {
        const missingNoteIds = noteIds.filter(noteId => this.notes[noteId] === undefined);

        if (missingNoteIds.length > 0) {
            const resp = await server.post('tree/load', { noteIds: missingNoteIds });

            this.addResp(resp.notes, resp.branches);
        }

        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                ws.logError(`Can't find note "${noteId}"`);

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
    async getNote(noteId, silentNotFoundError = false) {
        if (noteId === 'none') {
            return null;
        }

        return (await this.getNotes([noteId], silentNotFoundError))[0];
    }

    addBranch(branch) {
        this.branches[branch.branchId] = branch;
    }

    async getBranches(branchIds) {
        const missingBranchIds = branchIds.filter(branchId => this.branches[branchId] === undefined);

        if (missingBranchIds.length > 0) {
            const resp = await server.post('tree/load', { branchIds: branchIds });

            this.addResp(resp.notes, resp.branches);
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
}

const treeCache = new TreeCache();

export default treeCache;