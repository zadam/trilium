import FBranch from "../entities/fbranch.js";
import FNote from "../entities/fnote.js";
import FAttribute from "../entities/fattribute.js";
import server from "./server.js";
import appContext from "../components/app_context.js";
import FNoteComplement from "../entities/fnote_complement.js";

/**
 * Froca (FROntend CAche) keeps a read only cache of note tree structure in frontend's memory.
 * - notes are loaded lazily when unknown noteId is requested
 * - when note is loaded, all its parent and child branches are loaded as well. For a branch to be used, it's not must be loaded before
 * - deleted notes are present in the cache as well, but they don't have any branches. As a result check for deleted branch is done by presence check - if the branch is not there even though the corresponding note has been loaded, we can infer it is deleted.
 *
 * Note and branch deletions are corner cases and usually not needed.
 *
 * Backend has a similar cache called Becca
 */
class Froca {
    constructor() {
        this.initializedPromise = this.loadInitialTree();
    }

    async loadInitialTree() {
        const resp = await server.get('tree');

        // clear the cache only directly before adding new content which is important for e.g. switching to protected session

        /** @type {Object.<string, FNote>} */
        this.notes = {};

        /** @type {Object.<string, FBranch>} */
        this.branches = {};

        /** @type {Object.<string, FAttribute>} */
        this.attributes = {};

        /** @type {Object.<string, Promise<FNoteComplement>>} */
        this.noteComplementPromises = {};

        this.addResp(resp);
    }

    async loadSubTree(subTreeNoteId) {
        const resp = await server.get(`tree?subTreeNoteId=${subTreeNoteId}`);

        this.addResp(resp);

        return this.notes[subTreeNoteId];
    }

    addResp(resp) {
        const noteRows = resp.notes;
        const branchRows = resp.branches;
        const attributeRows = resp.attributes;

        const noteIdsToSort = new Set();

        for (const noteRow of noteRows) {
            const {noteId} = noteRow;

            let note = this.notes[noteId];

            if (note) {
                note.update(noteRow);

                // search note doesn't have child branches in database and all the children are virtual branches
                if (note.type !== 'search') {
                    for (const childNoteId of note.children) {
                        const childNote = this.notes[childNoteId];

                        if (childNote) {
                            childNote.parents = childNote.parents.filter(p => p !== noteId);

                            delete this.branches[childNote.parentToBranch[noteId]];
                            delete childNote.parentToBranch[noteId];
                        }
                    }

                    note.children = [];
                    note.childToBranch = {};
                }

                // we want to remove all "real" branches (represented in the database) since those will be created
                // from branches argument but want to preserve all virtual ones from saved search
                note.parents = note.parents.filter(parentNoteId => {
                    const parentNote = this.notes[parentNoteId];
                    const branch = this.branches[parentNote.childToBranch[noteId]];

                    if (!parentNote || !branch) {
                        return false;
                    }

                    if (branch.fromSearchNote) {
                        return true;
                    }

                    parentNote.children = parentNote.children.filter(p => p !== noteId);

                    delete this.branches[parentNote.childToBranch[noteId]];
                    delete parentNote.childToBranch[noteId];

                    return false;
                });
            }
            else {
                this.notes[noteId] = new FNote(this, noteRow);
            }
        }

        for (const branchRow of branchRows) {
            const branch = new FBranch(this, branchRow);

            this.branches[branch.branchId] = branch;

            const childNote = this.notes[branch.noteId];

            if (childNote) {
                childNote.addParent(branch.parentNoteId, branch.branchId, false);
            }

            const parentNote = this.notes[branch.parentNoteId];

            if (parentNote) {
                parentNote.addChild(branch.noteId, branch.branchId, false);

                noteIdsToSort.add(parentNote.noteId);
            }
        }

        for (const attributeRow of attributeRows) {
            const {attributeId} = attributeRow;

            this.attributes[attributeId] = new FAttribute(this, attributeRow);

            const note = this.notes[attributeRow.noteId];

            if (note && !note.attributes.includes(attributeId)) {
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

        // sort all of them at once, this avoids repeated sorts (#1480)
        for (const noteId of noteIdsToSort) {
            this.notes[noteId].sortChildren();
            this.notes[noteId].sortParents();
        }
    }

    async reloadNotes(noteIds) {
        if (noteIds.length === 0) {
            return;
        }

        noteIds = Array.from(new Set(noteIds)); // make noteIds unique

        const resp = await server.post('tree/load', { noteIds });

        this.addResp(resp);

        appContext.triggerEvent('notesReloaded', {noteIds});
    }

    async loadSearchNote(noteId) {
        const note = await this.getNote(noteId);

        if (!note || note.type !== 'search') {
            return;
        }

        const {searchResultNoteIds, highlightedTokens, error} = await server.get(`search-note/${note.noteId}`);

        if (!Array.isArray(searchResultNoteIds)) {
            throw new Error(`Search note '${note.noteId}' failed: ${searchResultNoteIds}`);
        }

        // reset all the virtual branches from old search results
        if (note.noteId in froca.notes) {
            froca.notes[note.noteId].children = [];
            froca.notes[note.noteId].childToBranch = {};
        }

        const branches = [...note.getParentBranches(), ...note.getChildBranches()];

        searchResultNoteIds.forEach((resultNoteId, index) => branches.push({
            // branchId should be repeatable since sometimes we reload some notes without rerendering the tree
            branchId: `virt-${note.noteId}-${resultNoteId}`,
            noteId: resultNoteId,
            parentNoteId: note.noteId,
            notePosition: (index + 1) * 10,
            fromSearchNote: true
        }));

        // update this note with standard (parent) branches + virtual (children) branches
        this.addResp({
            notes: [note],
            branches,
            attributes: []
        });

        froca.notes[note.noteId].searchResultsLoaded = true;
        froca.notes[note.noteId].highlightedTokens = highlightedTokens;

        return {error};
    }

    /** @returns {FNote[]} */
    getNotesFromCache(noteIds, silentNotFoundError = false) {
        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                console.trace(`Can't find note '${noteId}'`);

                return null;
            }
            else {
                return this.notes[noteId];
            }
        }).filter(note => !!note);
    }

    /** @returns {Promise<FNote[]>} */
    async getNotes(noteIds, silentNotFoundError = false) {
        noteIds = Array.from(new Set(noteIds)); // make unique
        const missingNoteIds = noteIds.filter(noteId => !this.notes[noteId]);

        await this.reloadNotes(missingNoteIds);

        return noteIds.map(noteId => {
            if (!this.notes[noteId] && !silentNotFoundError) {
                console.trace(`Can't find note '${noteId}'`);

                return null;
            } else {
                return this.notes[noteId];
            }
        }).filter(note => !!note);
    }

    /** @returns {Promise<boolean>} */
    async noteExists(noteId) {
        const notes = await this.getNotes([noteId], true);

        return notes.length === 1;
    }

    /** @returns {Promise<FNote>} */
    async getNote(noteId, silentNotFoundError = false) {
        if (noteId === 'none') {
            console.trace(`No 'none' note.`);
            return null;
        }
        else if (!noteId) {
            console.trace(`Falsy noteId '${noteId}', returning null.`);
            return null;
        }

        return (await this.getNotes([noteId], silentNotFoundError))[0];
    }

    /** @returns {FNote|null} */
    getNoteFromCache(noteId) {
        if (!noteId) {
            throw new Error("Empty noteId");
        }

        return this.notes[noteId];
    }

    /** @returns {FBranch[]} */
    getBranches(branchIds, silentNotFoundError = false) {
        return branchIds
            .map(branchId => this.getBranch(branchId, silentNotFoundError))
            .filter(b => !!b);
    }

    /** @returns {FBranch} */
    getBranch(branchId, silentNotFoundError = false) {
        if (!(branchId in this.branches)) {
            if (!silentNotFoundError) {
                logError(`Not existing branch '${branchId}'`);
            }
        }
        else {
            return this.branches[branchId];
        }
    }

    async getBranchId(parentNoteId, childNoteId) {
        if (childNoteId === 'root') {
            return 'none_root';
        }

        const child = await this.getNote(childNoteId);

        if (!child) {
            logError(`Could not find branchId for parent '${parentNoteId}', child '${childNoteId}' since child does not exist`);

            return null;
        }

        return child.parentToBranch[parentNoteId];
    }

    /**
     * @returns {Promise<FNoteComplement>}
     */
    async getNoteComplement(noteId) {
        if (!this.noteComplementPromises[noteId]) {
            this.noteComplementPromises[noteId] = server.get(`notes/${noteId}`)
                .then(row => new FNoteComplement(row))
                .catch(e => console.error(`Cannot get note complement for note '${noteId}'`));

            // we don't want to keep large payloads forever in memory, so we clean that up quite quickly
            // this cache is more meant to share the data between different components within one business transaction (e.g. loading of the note into the tab context and all the components)
            // this is also a workaround for missing invalidation after change
            this.noteComplementPromises[noteId].then(
                () => setTimeout(() => this.noteComplementPromises[noteId] = null, 1000)
            );
        }

        return await this.noteComplementPromises[noteId];
    }
}

const froca = new Froca();

export default froca;
