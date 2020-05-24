"use strict";

class NoteSet {
    constructor(notes = []) {
        /** @type {Note[]} */
        this.notes = notes;
        /** @type {boolean} */
        this.sorted = false;
    }

    add(note) {
        if (!this.hasNote(note)) {
            this.notes.push(note);
        }
    }

    addAll(notes) {
        for (const note of notes) {
            this.add(note);
        }
    }

    hasNote(note) {
        return this.hasNoteId(note.noteId);
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

    intersection(anotherNoteSet) {
        const newNoteSet = new NoteSet();

        for (const note of this.notes) {
            if (anotherNoteSet.hasNote(note)) {
                newNoteSet.add(note);
            }
        }

        return newNoteSet;
    }
}

module.exports = NoteSet;
