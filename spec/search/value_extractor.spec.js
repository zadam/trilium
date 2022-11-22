const {note} = require('./becca_mocking.js');
const ValueExtractor = require('../../src/services/search/value_extractor');
const becca = require('../../src/becca/becca');
const SearchContext = require("../../src/services/search/search_context");

const dsc = new SearchContext();

describe("Value extractor", () => {
    beforeEach(() => {
        becca.reset();
    });

    it("simple title extraction", async () => {
        const europe = note("Europe").note;

        const valueExtractor = new ValueExtractor(dsc, ["note", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(europe)).toEqual("Europe");
    });

    it("label extraction", async () => {
        const austria = note("Austria")
            .label("Capital", "Vienna")
            .note;

        let valueExtractor = new ValueExtractor(dsc, ["note", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria)).toEqual("Vienna");

        valueExtractor = new ValueExtractor(dsc, ["#capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria)).toEqual("Vienna");
    });

    it("parent/child property extraction", async () => {
        const vienna = note("Vienna");
        const europe = note("Europe")
            .child(note("Austria")
                .child(vienna));

        let valueExtractor = new ValueExtractor(dsc, ["note", "children", "children", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(europe.note)).toEqual("Vienna");

        valueExtractor = new ValueExtractor(dsc, ["note", "parents", "parents", "title"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(vienna.note)).toEqual("Europe");
    });

    it("extract through relation", async () => {
        const czechRepublic = note("Czech Republic").label("capital", "Prague");
        const slovakia = note("Slovakia").label("capital", "Bratislava");
        const austria = note("Austria")
                .relation('neighbor', czechRepublic.note)
                .relation('neighbor', slovakia.note);

        let valueExtractor = new ValueExtractor(dsc, ["note", "relations", "neighbor", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria.note)).toEqual("Prague");

        valueExtractor = new ValueExtractor(dsc, ["~neighbor", "labels", "capital"]);

        expect(valueExtractor.validate()).toBeFalsy();
        expect(valueExtractor.extract(austria.note)).toEqual("Prague");
    });
});

describe("Invalid value extractor property path", () => {
    it('each path must start with "note" (or label/relation)',
        () => expect(new ValueExtractor(dsc, ["neighbor"]).validate()).toBeTruthy());

    it("extra path element after terminal label",
        () => expect(new ValueExtractor(dsc, ["~neighbor", "labels", "capital", "noteId"]).validate()).toBeTruthy());

    it("extra path element after terminal title",
        () => expect(new ValueExtractor(dsc, ["note", "title", "isProtected"]).validate()).toBeTruthy());

    it("relation name and note property is missing",
        () => expect(new ValueExtractor(dsc, ["note", "relations"]).validate()).toBeTruthy());

    it("relation is specified but target note property is not specified",
        () => expect(new ValueExtractor(dsc, ["note", "relations", "myrel"]).validate()).toBeTruthy());
});
