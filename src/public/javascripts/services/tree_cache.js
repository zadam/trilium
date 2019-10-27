import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import ws from "./ws.js";
import server from "./server.js";

/**
 * TreeCache keeps a read only cache of note tree structure in frontend's memory.
 * - notes are loaded lazily when unknown noteId is requested
 * - when note is loaded, all its parent and child branches are loaded as well. For a branch to be used, it's not must be loaded before
 * - deleted notes are present in the cache as well, but they don't have any branches. As a result check for deleted branch is done by presence check - if the branch is not there even though the corresponding note has been loaded, we can infer it is deleted.
 *
 * Note and branch deletions are corner cases and usually not needed.
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

                        console.log("Cleaning up", childNote.parentToBranch[noteId]);

                        delete this.branches[childNote.parentToBranch[noteId]];
                        delete childNote.parentToBranch[noteId];
                    }
                }

                for (const parentNoteId of oldNote.parents) {
                    const parentNote = this.notes[parentNoteId];

                    if (parentNote) {
                        parentNote.children = parentNote.children.filter(p => p !== noteId);

                        delete this.branches[parentNote.childToBranch[noteId]];
                        delete parentNote.childToBranch[noteId];
                    }
                }
            }

            for (const branch of branchesByNotes[noteId] || []) { // can be empty for deleted notes
                if (noteId === '2Ndfjyv3EbEQ') {
                    console.log("Adding", branch.branchId);
                }

                this.branches[branch.branchId] = branch;
            }

            const note = new NoteShort(this, noteRow, branchesByNotes[noteId] || []);

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

    getBranches(branchIds) {
        return branchIds
            .map(branchId => this.getBranch(branchId))
            .filter(b => b !== null);
    }

    /** @return {Branch} */
    getBranch(branchId, silentNotFoundError = false) {
        if (!(branchId in this.branches)) {
            if (!silentNotFoundError) {
                console.error(`Not existing branch ${branchId}`);
            }
        }
        else {
            return this.branches[branchId];
        }
    }
}

const treeCache = new TreeCache();

export default treeCache;