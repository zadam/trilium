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
        this.notes = this.notes.concat(anotherNoteSet.notes);
    }

    minus(anotherNoteSet) {
        const newNoteSet = new NoteSet();

        for (const note of this.notes) {
            if (!anotherNoteSet.hasNoteId(note.noteId)) {
                newNoteSet.add(note);
            }
        }

        return newNoteSet;
    }
}

module.exports = NoteSet;
