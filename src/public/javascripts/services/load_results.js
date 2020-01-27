export class LoadResults {
    constructor() {
        this.noteIdToSync = {};
        this.sourceIdToNoteIds = {};
    }

    add(noteId, sourceId) {
        this.noteIdToSync[noteId] = this.noteIdToSync[noteId] || [];

        if (!this.noteIdToSync[noteId].includes(sourceId)) {
            this.noteIdToSync[noteId].push(sourceId);
        }

        this.sourceIdToNoteIds[sourceId] = this.sourceIdToNoteIds[sourceId] || [];

        if (!this.sourceIdToNoteIds[sourceId]) {
            this.sourceIdToNoteIds[sourceId].push(noteId);
        }
    }

    getNoteIds() {
        return Object.keys(this.noteIdToSync);
    }

    isNoteReloaded(noteId, sourceId) {
        const sourceIds = this.noteIdToSync[noteId];
        return sourceIds && !!sourceIds.find(sId => sId !== sourceId);
    }
}