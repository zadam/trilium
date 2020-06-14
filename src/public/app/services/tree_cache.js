import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import Attribute from "../entities/attribute.js";
import server from "./server.js";
import NoteComplement from "../entities/note_complement.js";

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
        this.initializedPromise = this.loadInitialTree();
    }

    async loadInitialTree() {
        const resp = await server.get('tree');

        await this.loadParents(resp, false);

        // clear the cache only directly before adding new content which is important for e.g. switching to protected session

        /** @type {Object.<string, NoteShort>} */
        this.notes = {};

        /** @type {Object.<string, Branch>} */
        this.branches = {};

        /** @type {Object.<string, Attribute>} */
        this.attributes = {};

        /** @type {Object.<string, Promise<NoteComplement>>} */
        this.noteComplementPromises = {};

        this.addResp(resp);
    }

    async loadParents(resp, additiveLoad) {
        const noteIds = new Set(resp.notes.map(note => note.noteId));
        const missingNoteIds = [];
        const existingNotes = additiveLoad ? this.notes : {};

        for (const branch of resp.branches) {
            if (!(branch.parentNoteId in existingNotes) && !noteIds.has(branch.parentNoteId) && branch.parentNoteId !== 'none') {
                missingNoteIds.push(branch.parentNoteId);
            }
        }

        for (const attr of resp.attributes) {
            if (attr.type === 'relation' && attr.name === 'template' && !(attr.value in existingNotes) && !noteIds.has(attr.value)) {
                missingNoteIds.push(attr.value);
            }

            if (!(attr.noteId in existingNotes) && !noteIds.has(attr.noteId)) {
                missingNoteIds.push(attr.noteId);
            }
        }

        if (missingNoteIds.length > 0) {
            const newResp = await server.post('tree/load', { noteIds: missingNoteIds });

            resp.notes = resp.notes.concat(newResp.notes);
            resp.branches = resp.branches.concat(newResp.branches);
            resp.attributes = resp.attributes.concat(newResp.attributes);

            await this.loadParents(resp, additiveLoad);
        }
    }

    addResp(resp) {
        const noteRows = resp.notes;
        const branchRows = resp.branches;
        const attributeRows = resp.attributes;

        for (const noteRow of noteRows) {
            const {noteId} = noteRow;

            const oldNote = this.notes[noteId];

            if (oldNote) {
                for (const childNoteId of oldNote.children) {
                    const childNote = this.notes[childNoteId];

                    if (childNote) {
                        childNote.parents = childNote.parents.filter(p => p !== noteId);

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

            const note = new NoteShort(this, noteRow);

            this.notes[note.noteId] = note;
        }

        for (const branchRow of branchRows) {
            const branch = new Branch(this, branchRow);

            this.branches[branch.branchId] = branch;

            const childNote = this.notes[branch.noteId];

            if (childNote) {
                childNote.addParent(branch.parentNoteId, branch.branchId);
            }

            const parentNote = this.notes[branch.parentNoteId];

            if (parentNote) {
                parentNote.addChild(branch.noteId, branch.branchId);
            }
        }

        for (const attributeRow of attributeRows) {
            const {attributeId} = attributeRow;

            this.attributes[attributeId] = new Attribute(this, attributeRow);

            const note = this.notes[attributeRow.noteId];

            if (!note.attributes.includes(attributeId)) {
                note.attributes.push(attributeId);
            }

            if (attributeRow.type === 'relation') {
                const targetNote = this.notes[attributeRow.value];

                if (targetNote) {
                    if (!targetNote.targetRelations.includes(attributeId)) {
                        targetNote.targetRelations.push(attributeId);
                    }
                }
            }
        }
    }

    async reloadNotes(noteIds) {
        if (noteIds.length === 0) {
            return;
        }

        noteIds = Array.from(new Set(noteIds)); // make noteIds unique

        const resp = await server.post('tree/load', { noteIds });

        await this.loadParents(resp, true);
        this.addResp(resp);

        for (const note of resp.notes) {
            if (note.type === 'search') {
                const searchResults = await server.get('search-note/' + note.noteId);

                if (!searchResults) {
                    throw new Error(`Search note ${note.noteId} failed.`);
                }

                // force to load all the notes at once instead of one by one
                await this.getNotes(searchResults.map(res => res.noteId));

                const branches = resp.branches.filter(b => b.noteId === note.noteId || b.parentNoteId === note.noteId);

                searchResults.forEach((result, index) => branches.push({
                    // branchId should be repeatable since sometimes we reload some notes without rerendering the tree
                    branchId: "virt" + result.noteId + '-' + note.noteId,
                    noteId: result.noteId,
                    parentNoteId: note.noteId,
                    prefix: this.getBranch(result.branchId).prefix,
                    notePosition: (index + 1) * 10
                }));

                // update this note with standard (parent) branches + virtual (children) branches
                this.addResp({
                    notes: [note],
                    branches,
                    attributes: []
                });
            }
        }
    }

    /** @return {NoteShort[]} */
    getNotesFromCache(noteIds, silentNotFoundError = false) {
        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                console.log(`Can't find note "${noteId}"`);

                return null;
            }
            else {
                return this.notes[noteId];
            }
        }).filter(note => !!note);
    }

    /** @return {Promise<NoteShort[]>} */
    async getNotes(noteIds, silentNotFoundError = false) {
        const missingNoteIds = noteIds.filter(noteId => !this.notes[noteId]);

        await this.reloadNotes(missingNoteIds);

        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                console.log(`Can't find note "${noteId}"`);

                return null;
            }
            else {
                return this.notes[noteId];
            }
        }).filter(note => !!note);
    }

    /** @return {Promise<boolean>} */
    async noteExists(noteId) {
        const notes = await this.getNotes([noteId], true);

        return notes.length === 1;
    }

    /** @return {Promise<NoteShort>} */
    async getNote(noteId, silentNotFoundError = false) {
        if (noteId === 'none') {
            console.trace(`No 'none' note.`);
            return null;
        }
        else if (!noteId) {
            console.log(`Falsy noteId ${noteId}, returning null.`);
            return null;
        }

        return (await this.getNotes([noteId], silentNotFoundError))[0];
    }

    getNoteFromCache(noteId) {
        return this.notes[noteId];
    }

    getBranches(branchIds, silentNotFoundError = false) {
        return branchIds
            .map(branchId => this.getBranch(branchId, silentNotFoundError))
            .filter(b => !!b);
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

    async getBranchId(parentNoteId, childNoteId) {
        const child = await this.getNote(childNoteId);

        return child.parentToBranch[parentNoteId];
    }

    /**
     * @return {Promise<NoteComplement>}
     */
    async getNoteComplement(noteId) {
        if (!this.noteComplementPromises[noteId]) {
            this.noteComplementPromises[noteId] = server.get('notes/' + noteId).then(row => new NoteComplement(row));
        }

        return await this.noteComplementPromises[noteId];
    }
}

const treeCache = new TreeCache();

export default treeCache;
