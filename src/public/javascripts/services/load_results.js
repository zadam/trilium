export class LoadResults {
    constructor() {
        this.noteIdToSourceId = {};
        this.sourceIdToNoteIds = {};
        
        this.branchIdToSourceId = {};
    }

    addNote(noteId, sourceId) {
        this.noteIdToSourceId[noteId] = this.noteIdToSourceId[noteId] || [];

        if (!this.noteIdToSourceId[noteId].includes(sourceId)) {
            this.noteIdToSourceId[noteId].push(sourceId);
        }

        this.sourceIdToNoteIds[sourceId] = this.sourceIdToNoteIds[sourceId] || [];

        if (!this.sourceIdToNoteIds[sourceId]) {
            this.sourceIdToNoteIds[sourceId].push(noteId);
        }
    }

    addBranch(branchId, sourceId) {
        this.branchIdToSourceId[branchId] = this.branchIdToSourceId[branchId] || [];
        this.branchIdToSourceId[branchId].push(sourceId);
    }

    addNoteReordering(parentNoteId, sourceId) {

    }

    addAttribute(attributeId, sourceId) {

    }

    getNoteIds() {
        return Object.keys(this.noteIdToSourceId);
    }

    isNoteReloaded(noteId, sourceId) {
        if (!noteId) {
            return false;
        }

        const sourceIds = this.noteIdToSourceId[noteId];
        return sourceIds && !!sourceIds.find(sId => sId !== sourceId);
    }
}