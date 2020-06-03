const {note} = require('./note_cache_mocking.js');
const ValueExtractor = require('../../src/services/search/value_extractor.js');
const noteCache = require('../../src/services/note_cache/note_cache.js');

describe("Value extractor", () => {
    beforeEach(() => {
        noteCache.reset();
    });

    it("simple title extraction", async () => {
        const europe = note("Europe").note;

        const valueExtractor = new ValueExtractor(["note", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(europe)).toEqual("Europe");
    });

    it("label extraction", async () => {
        const austria = note("Austria")
            .label("Capital", "Vienna")
            .note;

        let valueExtractor = new ValueExtractor(["note", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria)).toEqual("vienna");

        valueExtractor = new ValueExtractor(["#capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria)).toEqual("vienna");
    });

    it("parent/child property extraction", async () => {
        const vienna = note("Vienna");
        const europe = note("Europe")
            .child(note("Austria")
                .child(vienna));

        let valueExtractor = new ValueExtractor(["note", "children", "children", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(europe.note)).toEqual("Vienna");

        valueExtractor = new ValueExtractor(["note", "parents", "parents", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(vienna.note)).toEqual("Europe");
    });

    it("extract through relation", async () => {
        const czechRepublic = note("Czech Republic").label("capital", "Prague");
        const slovakia = note("Slovakia").label("capital", "Bratislava");
        const austria = note("Austria")
                .relation('neighbor', czechRepublic.note)
                .relation('neighbor', slovakia.note);

        let valueExtractor = new ValueExtractor(["note", "relations", "neighbor", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria.note)).toEqual("prague");

        valueExtractor = new ValueExtractor(["~neighbor", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria.note)).toEqual("prague");
    });
});

describe("Invalid value extractor property path", () => {
    it('each path must start with "note" (or label/relation)',
        () => expect(new ValueExtractor(["neighbor"]).validate()).toBeTruthy());

    it("extra path element after terminal label",
        () => expect(new ValueExtractor(["~neighbor", "labels", "capital", "noteId"]).validate()).toBeTruthy());

    it("extra path element after terminal title",
        () => expect(new ValueExtractor(["note", "title", "isProtected"]).validate()).toBeTruthy());

    it("relation name and note property is missing",
        () => expect(new ValueExtractor(["note", "relations"]).validate()).toBeTruthy());

    it("relation is specified but target note property is not specified",
        () => expect(new ValueExtractor(["note", "relations", "myrel"]).validate()).toBeTruthy());
});
