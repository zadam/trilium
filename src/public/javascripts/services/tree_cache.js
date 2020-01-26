import Branch from "../entities/branch.js";
import NoteShort from "../entities/note_short.js";
import Attribute from "../entities/attribute.js";
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

        /** @type {Object.<string, Attribute>} */
        this.attributes = {};
    }

    load(noteRows, branchRows, attributeRows) {
        this.init();

        this.addResp(noteRows, branchRows, attributeRows);
    }

    addResp(noteRows, branchRows, attributeRows) {
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
                    if (!note.targetRelations.includes(attributeId)) {
                        note.targetRelations.push(attributeId);
                    }
                }
            }
        }
    }

    async reloadData(noteIds) {
        const resp = await server.post('tree/load', { noteIds });

        this.addResp(resp.notes, resp.branches, resp.attributes);

        for (const note of resp.notes) {
            if (note.type === 'search') {
                const searchResults = await server.get('search-note/' + note.noteId);

                if (!searchResults) {
                    throw new Error(`Search note ${note.noteId} failed.`);
                }

                // force to load all the notes at once instead of one by one
                await treeCache.getNotes(searchResults.map(res => res.noteId));

                const branches = resp.branches.filter(b => b.noteId === note.noteId || b.parentNoteId === note.noteId);

                searchResults.forEach((result, index) => branches.push({
                    // branchId should be repeatable since sometimes we reload some notes without rerendering the tree
                    branchId: "virt" + result.noteId + '-' + note.noteId,
                    noteId: result.noteId,
                    parentNoteId: note.noteId,
                    prefix: treeCache.getBranch(result.branchId).prefix,
                    notePosition: (index + 1) * 10
                }));

                // update this note with standard (parent) branches + virtual (children) branches
                treeCache.addResp([note], branches, []);
            }
        }
    }

    /** @return {Promise<NoteShort[]>} */
    async getNotes(noteIds, silentNotFoundError = false) {
        const missingNoteIds = noteIds.filter(noteId => !this.notes[noteId]);

        if (missingNoteIds.length > 0) {
            await this.reloadNotes(missingNoteIds);
        }

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
            console.log(`No 'none' note.`);
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

    async getBranchId(parentNoteId, childNoteId) {
        const child = await this.getNote(childNoteId);

        return child.parentToBranch[parentNoteId];
    }

    syncDataListener({data}) {return;
        const noteIdsToRefresh = new Set();

        data.filter(sync => sync.entityName === 'branches').forEach(sync => {
            const branch = this.branches[sync.entityId];
            // we assume that the cache contains the old branch state and we add also the old parentNoteId
            // so that the old parent can also be updated
            noteIdsToRefresh.add(branch.parentNoteId);

            // this should then contain new parentNoteId for which we should also update the cache
            noteIdsToRefresh.add(sync.parentNoteId);
        });

        data.filter(sync => sync.entityName === 'notes').forEach(sync => noteIdsToRefresh.add(sync.entityId));

        data.filter(sync => sync.entityName === 'note_reordering').forEach(sync => noteIdsToRefresh.add(sync.entityId));

        data.filter(sync => sync.entityName === 'attributes').forEach(sync => {
            const note = treeCache.notes[sync.noteId];

            if (note && note.__attributeCache) {
                noteIdsToRefresh.add(sync.entityId);
            }
        });

        if (noteIdsToRefresh.size > 0) {
            this.reloadNotes({noteIds: Array.from(noteIdsToRefresh)});
        }
    }
}

const treeCache = new TreeCache();

export default treeCache;