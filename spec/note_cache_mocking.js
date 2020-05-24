const Note = require('../src/services/note_cache/entities/note');
const Branch = require('../src/services/note_cache/entities/branch');
const Attribute = require('../src/services/note_cache/entities/attribute');
const noteCache = require('../src/services/note_cache/note_cache');
const randtoken = require('rand-token').generator({source: 'crypto'});

/** @return {Note} */
function findNoteByTitle(searchResults, title) {
    return searchResults
        .map(sr => noteCache.notes[sr.noteId])
        .find(note => note.title === title);
}

class NoteBuilder {
    constructor(note) {
        this.note = note;
    }

    label(name, value = '', isInheritable = false) {
        new Attribute(noteCache, {
            attributeId: id(),
            noteId: this.note.noteId,
            type: 'label',
            isInheritable,
            name,
            value
        });

        return this;
    }

    relation(name, targetNote) {
        new Attribute(noteCache, {
            attributeId: id(),
            noteId: this.note.noteId,
            type: 'relation',
            name,
            value: targetNote.noteId
        });

        return this;
    }

    child(childNoteBuilder, prefix = "") {
        new Branch(noteCache, {
            branchId: id(),
            noteId: childNoteBuilder.note.noteId,
            parentNoteId: this.note.noteId,
            prefix
        });

        return this;
    }
}

function id() {
    return randtoken.generate(10);
}

function note(title) {
    const note = new Note(noteCache, {noteId: id(), title});

    return new NoteBuilder(note);
}

module.exports = {
    NoteBuilder,
    findNoteByTitle,
    note
};
