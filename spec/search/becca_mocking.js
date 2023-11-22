const BNote = require('../../src/becca/entities/bnote.js');
const BBranch = require('../../src/becca/entities/bbranch.js');
const BAttribute = require('../../src/becca/entities/battribute.js');
const becca = require('../../src/becca/becca.js');
const randtoken = require('rand-token').generator({source: 'crypto'});

/** @returns {BNote} */
function findNoteByTitle(searchResults, title) {
    return searchResults
        .map(sr => becca.notes[sr.noteId])
        .find(note => note.title === title);
}

class NoteBuilder {
    constructor(note) {
        this.note = note;
    }

    label(name, value = '', isInheritable = false) {
        new BAttribute({
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
        new BAttribute({
            attributeId: id(),
            noteId: this.note.noteId,
            type: 'relation',
            name,
            value: targetNote.noteId
        });

        return this;
    }

    child(childNoteBuilder, prefix = "") {
        new BBranch({
            branchId: id(),
            noteId: childNoteBuilder.note.noteId,
            parentNoteId: this.note.noteId,
            prefix,
            notePosition: 10
        });

        return this;
    }
}

function id() {
    return randtoken.generate(10);
}

function note(title, extraParams = {}) {
    const row = Object.assign({
        noteId: id(),
        title: title,
        type: 'text',
        mime: 'text/html'
    }, extraParams);

    const note = new BNote(row);

    return new NoteBuilder(note);
}

module.exports = {
    NoteBuilder,
    findNoteByTitle,
    note
};
