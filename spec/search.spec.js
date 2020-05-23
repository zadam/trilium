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
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
        );

        const parsingContext = new ParsingContext();
        const searchResults = await searchService.findNotesWithQuery('europe austria', parsingContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("only end leafs are results", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
        );

        const parsingContext = new ParsingContext();
        const searchResults = await searchService.findNotesWithQuery('europe', parsingContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("only end leafs are results", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
        );

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('Vienna', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("numeric label comparison", async () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('population', '8859000'))
                .child(note("Czech Republic")
                    .label('population', '10650000'))
        );

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('#country #population >= 10000000', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("numeric label comparison fallback to string comparison", async () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('established', '1955-07-27'))
                .child(note("Czech Republic")
                    .label('established', '1993-01-01'))
                .child(note("Hungary")
                    .label('established', '..wrong..'))
        );

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('#established < 1990', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("logical or", async () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('languageFamily', 'germanic'))
                .child(note("Czech Republic")
                    .label('languageFamily', 'slavic'))
                .child(note("Hungary")
                    .label('languageFamily', 'finnougric'))
            );

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('#languageFamily = slavic OR #languageFamily = germanic', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("fuzzy attribute search", async () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('languageFamily', 'germanic'))
                .child(note("Czech Republic")
                    .label('languageFamily', 'slavic')));

        let parsingContext = new ParsingContext({fuzzyAttributeSearch: false});

        let searchResults = await searchService.findNotesWithQuery('#language', parsingContext);
        expect(searchResults.length).toEqual(0);

        searchResults = await searchService.findNotesWithQuery('#languageFamily=ger', parsingContext);
        expect(searchResults.length).toEqual(0);

        parsingContext = new ParsingContext({fuzzyAttributeSearch: true});

        searchResults = await searchService.findNotesWithQuery('#language', parsingContext);
        expect(searchResults.length).toEqual(2);

        searchResults = await searchService.findNotesWithQuery('#languageFamily=ger', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("filter by note property", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")));

        const parsingContext = new ParsingContext();

        const searchResults = await searchService.findNotesWithQuery('# note.title =* czech', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("filter by note's parent", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")))
            .child(note("Asia")
                .child(note('Taiwan')));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.parent.title = Europe', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.parent.title = Asia', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Taiwan")).toBeTruthy();
    });

    it("filter by note's child", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")))
            .child(note("Oceania")
                .child(note('Australia')));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.child.title =* Aust', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Oceania")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.child.title =* Aust AND note.child.title *= republic', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("filter by relation's note properties", async () => {
        const austria = note("Austria");
        const portugal = note("Portugal");

        rootNote
            .child(note("Europe")
                .child(austria)
                .child(note("Czech Republic")
                    .relation('neighbor', austria.note))
                .child(portugal)
                .child(note("Spain")
                    .relation('neighbor', portugal.note))
            );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# ~neighbor.title = Austria', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# ~neighbor.title = Portugal', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Spain")).toBeTruthy();
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

    label(name, value, isInheritable = false) {
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
