const searchService = require('../../src/services/search/services/search.js');
const Note = require('../../src/services/note_cache/entities/note.js');
const Branch = require('../../src/services/note_cache/entities/branch.js');
const SearchContext = require('../../src/services/search/search_context.js');
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

    it("simple path match", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
        );

        const searchContext = new SearchContext();
        const searchResults = searchService.findNotesWithQuery('europe austria', searchContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("normal search looks also at attributes", () => {
        const austria = note("Austria");
        const vienna = note("Vienna");

        rootNote
            .child(austria
                .relation('capital', vienna))
            .child(vienna
                .label('inhabitants', '1888776'));

        const searchContext = new SearchContext();
        let searchResults = searchService.findNotesWithQuery('capital', searchContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('inhabitants', searchContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Vienna")).toBeTruthy();
    });

    it("normal search looks also at type and mime", () => {
        rootNote
            .child(note("Effective Java", 'book', ''))
            .child(note("Hello World.java", 'code', 'text/x-java'));

        const searchContext = new SearchContext();
        let searchResults = searchService.findNotesWithQuery('book', searchContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Effective Java")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('text', searchContext); // should match mime

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Hello World.java")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('java', searchContext);

        expect(searchResults.length).toEqual(2);
    });

    it("only end leafs are results", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
        );

        const searchContext = new SearchContext();
        const searchResults = searchService.findNotesWithQuery('europe', searchContext);

        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("only end leafs are results", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
        );

        const searchContext = new SearchContext();

        const searchResults = searchService.findNotesWithQuery('Vienna', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("label comparison with short syntax", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
                .child(note("Czech Republic")
                    .label('capital', 'Prague'))
            );

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('#capital=Vienna', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("label comparison with full syntax", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .label('capital', 'Vienna'))
                .child(note("Czech Republic")
                    .label('capital', 'Prague'))
            );

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.labels.capital=Prague', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("numeric label comparison", () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('population', '8859000'))
                .child(note("Czech Republic")
                    .label('population', '10650000'))
        );

        const searchContext = new SearchContext();

        const searchResults = searchService.findNotesWithQuery('#country #population >= 10000000', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("numeric label comparison fallback to string comparison", () => {
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

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('#established <= "1955-01-01"', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Hungary")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('#established > "1955-01-01"', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("smart date comparisons", () => {
        // dates should not be coerced into numbers which would then give wrong numbers

        rootNote
            .child(note("My note")
                .label('year', new Date().getFullYear().toString())
                .label('month', dateUtils.localNowDate().substr(0, 7))
                .label('date', dateUtils.localNowDate())
                .label('dateTime', dateUtils.localNowDateTime())
            );

        const searchContext = new SearchContext();

        function test(query, expectedResultCount) {
            const searchResults = searchService.findNotesWithQuery(query, searchContext);
            expect(searchResults.length).toEqual(expectedResultCount);

            if (expectedResultCount === 1) {
                expect(findNoteByTitle(searchResults, "My note")).toBeTruthy();
            }
        }

        test("#year = YEAR", 1);
        test("#year = 'YEAR'", 0);
        test("#year >= YEAR", 1);
        test("#year <= YEAR", 1);
        test("#year < YEAR+1", 1);
        test("#year < YEAR + 1", 1);
        test("#year < year + 1", 1);
        test("#year > YEAR+1", 0);

        test("#month = MONTH", 1);
        test("#month = month", 1);
        test("#month = 'MONTH'", 0);

        test("#date = TODAY", 1);
        test("#date = today", 1);
        test("#date = 'today'", 0);
        test("#date > TODAY", 0);
        test("#date > TODAY-1", 1);
        test("#date > TODAY - 1", 1);
        test("#date < TODAY+1", 1);
        test("#date < TODAY + 1", 1);
        test("#date < 'TODAY + 1'", 1);

        test("#dateTime <= NOW+10", 1);
        test("#dateTime <= NOW + 10", 1);
        test("#dateTime < NOW-10", 0);
        test("#dateTime >= NOW-10", 1);
        test("#dateTime < NOW-10", 0);
    });

    it("logical or", () => {
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

        const searchContext = new SearchContext();

        const searchResults = searchService.findNotesWithQuery('#languageFamily = slavic OR #languageFamily = germanic', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("fuzzy attribute search", () => {
        rootNote
            .child(note("Europe")
                .label('country', '', true)
                .child(note("Austria")
                    .label('languageFamily', 'germanic'))
                .child(note("Czech Republic")
                    .label('languageFamily', 'slavic')));

        let searchContext = new SearchContext({fuzzyAttributeSearch: false});

        let searchResults = searchService.findNotesWithQuery('#language', searchContext);
        expect(searchResults.length).toEqual(0);

        searchResults = searchService.findNotesWithQuery('#languageFamily=ger', searchContext);
        expect(searchResults.length).toEqual(0);

        searchContext = new SearchContext({fuzzyAttributeSearch: true});

        searchResults = searchService.findNotesWithQuery('#language', searchContext);
        expect(searchResults.length).toEqual(2);

        searchResults = searchService.findNotesWithQuery('#languageFamily=ger', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("filter by note property", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")));

        const searchContext = new SearchContext();

        const searchResults = searchService.findNotesWithQuery('# note.title =* czech', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("filter by note's parent", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria"))
                .child(note("Czech Republic")
                    .child(note("Prague")))
            )
            .child(note("Asia")
                .child(note('Taiwan')));

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Asia', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Taiwan")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# note.parents.parents.title = Europe', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Prague")).toBeTruthy();
    });

    it("filter by note's ancestor", () => {
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

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('#city AND note.ancestors.title = Europe', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Prague")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('#city AND note.ancestors.title = Asia', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Taipei")).toBeTruthy();
    });

    it("filter by note's child", () => {
        rootNote
            .child(note("Europe")
                .child(note("Austria")
                    .child(note("Vienna")))
                .child(note("Czech Republic")
                    .child(note("Prague"))))
            .child(note("Oceania")
                .child(note('Australia')));

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.children.title =* Aust', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Oceania")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# note.children.title =* Aust AND note.children.title *= republic', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# note.children.children.title = Prague', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Europe")).toBeTruthy();
    });

    it("filter by relation's note properties using short syntax", () => {
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

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# ~neighbor.title = Austria', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# ~neighbor.title = Portugal', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Spain")).toBeTruthy();
    });

    it("filter by relation's note properties using long syntax", () => {
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

        const searchContext = new SearchContext();

        const searchResults = searchService.findNotesWithQuery('# note.relations.neighbor.title = Austria', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    });

    it("filter by multiple level relation", () => {
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

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.relations.neighbor.relations.neighbor.title = Italy', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();

        searchResults = searchService.findNotesWithQuery('# note.relations.neighbor.relations.neighbor.title = Ukraine', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
        expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    });

    it("test note properties", () => {
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

        austria.note.isProtected = false;
        austria.note.dateCreated = '2020-05-14 12:11:42.001+0200';
        austria.note.dateModified = '2020-05-14 13:11:42.001+0200';
        austria.note.utcDateCreated = '2020-05-14 10:11:42.001Z';
        austria.note.utcDateModified = '2020-05-14 11:11:42.001Z';
        austria.note.contentLength = 1001;

        const searchContext = new SearchContext();

        function test(propertyName, value, expectedResultCount) {
            const searchResults = searchService.findNotesWithQuery(`# note.${propertyName} = ${value}`, searchContext);
            expect(searchResults.length).toEqual(expectedResultCount);
        }

        test("type", "text", 6);
        test("type", "code", 0);

        test("mime", "text/html", 6);
        test("mime", "application/json", 0);

        test("isProtected", "false", 7);
        test("isProtected", "true", 0);

        test("dateCreated", "'2020-05-14 12:11:42.001+0200'", 1);
        test("dateCreated", "wrong", 0);

        test("dateModified", "'2020-05-14 13:11:42.001+0200'", 1);
        test("dateModified", "wrong", 0);

        test("utcDateCreated", "'2020-05-14 10:11:42.001Z'", 1);
        test("utcDateCreated", "wrong", 0);

        test("utcDateModified", "'2020-05-14 11:11:42.001Z'", 1);
        test("utcDateModified", "wrong", 0);

        test("parentCount", "2", 1);
        test("parentCount", "3", 0);

        test("childrenCount", "2", 1);
        test("childrenCount", "10", 0);

        test("attributeCount", "3", 1);
        test("attributeCount", "4", 0);

        test("labelCount", "2", 1);
        test("labelCount", "3", 0);

        test("relationCount", "1", 1);
        test("relationCount", "2", 0);
    });

    it("test order by", () => {
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

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.title', searchContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Slovakia");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Ukraine");

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital', searchContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Slovakia");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Ukraine");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Austria");

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital DESC', searchContext);
        expect(searchResults.length).toEqual(4);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");
        expect(noteCache.notes[searchResults[2].noteId].title).toEqual("Ukraine");
        expect(noteCache.notes[searchResults[3].noteId].title).toEqual("Slovakia");

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy note.labels.capital DESC limit 2', searchContext);
        expect(searchResults.length).toEqual(2);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Austria");
        expect(noteCache.notes[searchResults[1].noteId].title).toEqual("Italy");

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy #capital DESC limit 0', searchContext);
        expect(searchResults.length).toEqual(0);

        searchResults = searchService.findNotesWithQuery('# note.parents.title = Europe orderBy #capital DESC limit 1000', searchContext);
        expect(searchResults.length).toEqual(4);
    });

    it("test not(...)", () => {
        const italy = note("Italy").label("capital", "Rome");
        const slovakia = note("Slovakia").label("capital", "Bratislava");

        rootNote
            .child(note("Europe")
                .child(slovakia)
                .child(italy));

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# not(#capital) and note.noteId != root', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Europe");

        searchResults = searchService.findNotesWithQuery('#!capital and note.noteId != root', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Europe");
    });

    it("test note.text *=* something", () => {
        const italy = note("Italy").label("capital", "Rome");
        const slovakia = note("Slovakia").label("capital", "Bratislava");

        rootNote
            .child(note("Europe")
                .child(slovakia)
                .child(italy));

        const searchContext = new SearchContext();

        let searchResults = searchService.findNotesWithQuery('# note.text *=* rati and note.noteId != root', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Slovakia");
    });

    it("test that fulltext does not match archived notes", () => {
        const italy = note("Italy").label("capital", "Rome");
        const slovakia = note("Slovakia").label("capital", "Bratislava");

        rootNote
            .child(note("Reddit").label('archived', '', true)
                .child(note('Post X'))
                .child(note('Post Y')))
            .child(note ('Reddit is bad'));

        const searchContext = new SearchContext({excludeArchived: true});

        let searchResults = searchService.findNotesWithQuery('reddit', searchContext);
        expect(searchResults.length).toEqual(1);
        expect(noteCache.notes[searchResults[0].noteId].title).toEqual("Reddit is bad");
    });

    // FIXME: test what happens when we order without any filter criteria

    // it("comparison between labels", () => {
    //     rootNote
    //         .child(note("Europe")
    //             .child(note("Austria")
    //                 .label('capital', 'Vienna')
    //                 .label('largestCity', 'Vienna'))
    //             .child(note("Canada")
    //                 .label('capital', 'Ottawa')
    //                 .label('largestCity', 'Toronto'))
    //             .child(note("Czech Republic")
    //                 .label('capital', 'Prague')
    //                 .label('largestCity', 'Prague'))
    //         );
    //
    //     const searchContext = new SearchContext();
    //
    //     const searchResults = searchService.findNotesWithQuery('#capital = #largestCity', searchContext);
    //     expect(searchResults.length).toEqual(2);
    //     expect(findNoteByTitle(searchResults, "Czech Republic")).toBeTruthy();
    //     expect(findNoteByTitle(searchResults, "Austria")).toBeTruthy();
    // })
});
