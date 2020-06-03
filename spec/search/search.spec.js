const searchService = require('../../src/services/search/search.js');
const Note = require('../../src/services/note_cache/entities/note.js');
const Branch = require('../../src/services/note_cache/entities/branch.js');
const Attribute = require('../../src/services/note_cache/entities/attribute.js');
const ParsingContext = require('../../src/services/search/parsing_context.js');
const dateUtils = require('../../src/services/date_utils.js');
const noteCache = require('../../src/services/note_cache/note_cache.js');
const {NoteBuilder, findNoteByTitle, note} = require('./note_cache_mocking.js');

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

    it("label comparison with short syntax", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
                .child(note("Czech Republic")
                    .label('capital', 'Prague'))
            );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('#capital=Vienna', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("label comparison with full syntax", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
                .child(note("Czech Republic")
                    .label('capital', 'Prague'))
            );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.labels.capital=Prague', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
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
        // dates should not be coerced into numbers which would then give wrong numbers

        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('established', '1955-07-27'))
                .child(note("Czech Republic")
                    .label('established', '1993-01-01'))
                .child(note("Hungary")
                    .label('established', '1920-06-04'))
        );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('#established <= 1955-01-01', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Hungary")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('#established > 1955-01-01', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("smart date comparisons", async () => {
        // dates should not be coerced into numbers which would then give wrong numbers

        rootNote
            .child(note("My note")
                .label('year', new Date().getFullYear().toString())
                .label('month', dateUtils.localNowDate().substr(0, 7))
                .label('date', dateUtils.localNowDate())
                .label('dateTime', dateUtils.localNowDateTime())
            );

        const parsingContext = new ParsingContext();

        async function test(query, expectedResultCount) {
            const searchResults = await searchService.findNotesWithQuery(query, parsingContext);
            expect(searchResults.length).toEqual(expectedResultCount);

            if (expectedResultCount === 1) {
                expect(findNoteByTitle(searchResults, "My note")).toBeTruthy();
            }
        }

        await test("#year = YEAR", 1);
        await test("#year >= YEAR", 1);
        await test("#year <= YEAR", 1);
        await test("#year < YEAR+1", 1);
        await test("#year > YEAR+1", 0);

        await test("#month = MONTH", 1);

        await test("#date = TODAY", 1);
        await test("#date > TODAY", 0);
        await test("#date > TODAY-1", 1);
        await test("#date < TODAY+1", 1);
        await test("#date < 'TODAY + 1'", 1);

        await test("#dateTime <= NOW+10", 1);
        await test("#dateTime < NOW-10", 0);
        await test("#dateTime >= NOW-10", 1);
        await test("#dateTime < NOW-10", 0);
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
                .child(note("Czech Republic")
                    .child(note("Prague")))
            )
            .child(note("Asia")
                .child(note('Taiwan')));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Asia', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Taiwan")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.parents.parents.title = Europe', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Prague")).toBeTruthy();
    });

    it("filter by note's ancestor", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")
                    .child(note("Prague").label('city')))
            )
            .child(note("Asia")
                .child(note('Taiwan')
                    .child(note('Taipei').label('city')))
            );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('#city AND note.ancestors.title = Europe', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Prague")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('#city AND note.ancestors.title = Asia', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Taipei")).toBeTruthy();
    });

    it("filter by note's child", async () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .child(note("Vienna")))
                .child(note("Czech Republic")
                    .child(note("Prague"))))
            .child(note("Oceania")
                .child(note('Australia')));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.children.title =* Aust', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Oceania")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.children.title =* Aust AND note.children.title *= republic', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.children.children.title = Prague', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("filter by relation's note properties using short syntax", async () => {
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

    it("filter by relation's note properties using long syntax", async () => {
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

        const searchResults = await searchService.findNotesWithQuery('# note.relations.neighbor.title = Austria', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("filter by multiple level relation", async () => {
        const austria = note("Austria");
        const slovakia = note("Slovakia");
        const italy = note("Italy");
        const ukraine = note("Ukraine");

        rootNote
            .child(note("Europe")
                .child(austria
                    .relation('neighbor', italy.note)
                    .relation('neighbor', slovakia.note))
                .child(note("Czech Republic")
                    .relation('neighbor', austria.note)
                    .relation('neighbor', slovakia.note))
                .child(slovakia
                    .relation('neighbor', ukraine.note))
                .child(ukraine)
            );

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.relations.neighbor.relations.neighbor.title = Italy', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = await searchService.findNotesWithQuery('# note.relations.neighbor.relations.neighbor.title = Ukraine', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("test note properties", async () => {
        const austria = note("Austria");

        austria.relation('myself', austria.note);
        austria.label('capital', 'Vienna');
        austria.label('population', '8859000');

        rootNote
            .child(note("Asia"))
            .child(note("Europe")
                .child(austria
                    .child(note("Vienna"))
                    .child(note("Sebastian Kurz"))
                )
            )
            .child(note("Mozart")
                .child(austria));

        austria.note.type = 'text';
        austria.note.mime = 'text/html';
        austria.note.isProtected = false;
        austria.note.dateCreated = '2020-05-14 12:11:42.001+0200';
        austria.note.dateModified = '2020-05-14 13:11:42.001+0200';
        austria.note.utcDateCreated = '2020-05-14 10:11:42.001Z';
        austria.note.utcDateModified = '2020-05-14 11:11:42.001Z';
        austria.note.contentLength = 1001;

        const parsingContext = new ParsingContext();

        async function test(propertyName, value, expectedResultCount) {
            const searchResults = await searchService.findNotesWithQuery(`# note.${propertyName} = ${value}`, parsingContext);
            expect(searchResults.length).toEqual(expectedResultCount);

            if (expectedResultCount === 1) {
                expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
            }
        }

        await test("type", "text", 1);
        await test("type", "code", 0);

        await test("mime", "text/html", 1);
        await test("mime", "application/json", 0);

        await test("isProtected", "false", 7);
        await test("isProtected", "true", 0);

        await test("dateCreated", "'2020-05-14 12:11:42.001+0200'", 1);
        await test("dateCreated", "wrong", 0);

        await test("dateModified", "'2020-05-14 13:11:42.001+0200'", 1);
        await test("dateModified", "wrong", 0);

        await test("utcDateCreated", "'2020-05-14 10:11:42.001Z'", 1);
        await test("utcDateCreated", "wrong", 0);

        await test("utcDateModified", "'2020-05-14 11:11:42.001Z'", 1);
        await test("utcDateModified", "wrong", 0);

        await test("contentLength", "1001", 1);
        await test("contentLength", "10010", 0);

        await test("parentCount", "2", 1);
        await test("parentCount", "3", 0);

        await test("childrenCount", "2", 1);
        await test("childrenCount", "10", 0);

        await test("attributeCount", "3", 1);
        await test("attributeCount", "4", 0);

        await test("labelCount", "2", 1);
        await test("labelCount", "3", 0);

        await test("relationCount", "1", 1);
        await test("relationCount", "2", 0);
    });

    it("test order by", async () => {
        const italy = note("Italy").label("capital", "Rome");
        const slovakia = note("Slovakia").label("capital", "Bratislava");
        const austria = note("Austria").label("capital", "Vienna");
        const ukraine = note("Ukraine").label("capital", "Kiev");

        rootNote
            .child(note("Europe")
                .child(ukraine)
                .child(slovakia)
                .child(austria)
                .child(italy));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.title', parsingContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Slovakia");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Ukraine");

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital', parsingContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Slovakia");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Ukraine");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Austria");

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital DESC', parsingContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Ukraine");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Slovakia");

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital DESC limit 2', parsingContext);
        expect(searchResults.length).toEqual(2);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy #capital DESC limit 0', parsingContext);
        expect(searchResults.length).toEqual(0);

        searchResults = await searchService.findNotesWithQuery('# note.parents.title = Europe orderBy #capital DESC limit 1000', parsingContext);
        expect(searchResults.length).toEqual(4);
    });

    it("test not(...)", async () => {
        const italy = note("Italy").label("capital", "Rome");
        const slovakia = note("Slovakia").label("capital", "Bratislava");

        rootNote
            .child(note("Europe")
                .child(slovakia)
                .child(italy));

        const parsingContext = new ParsingContext();

        let searchResults = await searchService.findNotesWithQuery('# not(#capital) and note.noteId != root', parsingContext);
        expect(searchResults.length).toEqual(1);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Europe");
    });

    // FIXME: test what happens when we order without any filter criteria
});
