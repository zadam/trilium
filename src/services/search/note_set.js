"use strict";

class NoteSet {
    constructor(notes = []) {
        this.notes = notes;
    }

    add(note) {
        this.notes.push(note);
    }

    addAll(notes) {
        this.notes.push(...notes);
    }

    hasNoteId(noteId) {
        // TODO: optimize
        return !!this.notes.find(note => note.noteId === noteId);
    }

    mergeIn(anotherNoteSet) {
        this.notes = this.notes.concat(anotherNoteSet.arr);
    }
}

module.exports = NoteSet;
