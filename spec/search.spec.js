const searchService = require('../src/services/search/search');
const Note = require('../src/services/note_cache/entities/note');
const Branch = require('../src/services/note_cache/entities/branch');
const Attribute = require('../src/services/note_cache/entities/attribute');
const ParsingContext = require('../src/services/search/parsing_context');
const noteCache = require('../src/services/note_cache/note_cache');
const randtoken = require('rand-token').generator({source: 'crypto'});

describe("Search", () => {
    let rootNote;

    beforeEach(() => {
        noteCache.reset();

        rootNote = new NoteBuilder(new Note(noteCache, {noteId: 'root', title: 'root'}));
        new Branch(noteCache, {branchId: 'root', noteId: 'root', parentNoteId: 'none'});
    });

    it("simple path match", async () => {
        rootNote.child(
            note("Europe")
                .child(
                    note("Austria")
                )
        );

        const parsingContext = new ParsingContext();
        const searchResults = await searchService.findNotesWithQuery('europe austria', parsingContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("only end leafs are results", async () => {
        rootNote.child(
            note("Europe")
                .child(
                    note("Austria")
                )
        );

        const parsingContext = new ParsingContext();
        const searchResults = await searchService.findNotesWithQuery('europe', parsingContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("only end leafs are results", async () => {
        rootNote.child(
            note("Europe")
                .child(
                    note("Austria")
                        .label('capital', 'Vienna')
                )
        );

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('Vienna', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });
});

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

    label(name, value) {
        new Attribute(noteCache, {
            attributeId: id(),
            noteId: this.note.noteId,
            type: 'label',
            name,
            value
        });

        return this;
    }

    relation(name, note) {
        new Attribute(noteCache, {
            attributeId: id(),
            noteId: this.note.noteId,
            type: 'relation',
            name,
            value: note.noteId
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
