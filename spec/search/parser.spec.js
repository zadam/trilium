const SearchContext = require("../../src/services/search/search_context.js");
const parse = require('../../src/services/search/services/parse.js');

function tokens(toks, cur = 0) {
    return toks.map(arg => {
        if (Array.isArray(arg)) {
            return tokens(arg, cur);
        }
        else {
            cur += arg.length;

            return {
                token: arg,
                inQuotes: false,
                startIndex: cur - arg.length,
                endIndex: cur - 1
            };
        }
    });
}

describe("Parser", () => {
    it("fulltext parser without content", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello", "hi"]),
            expressionTokens: [],
            searchContext: new SearchContext({includeNoteContent: false})
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        expect(rootExp.subExpressions[0].constructor.name).toEqual("NoteCacheFlatTextExp");
        expect(rootExp.subExpressions[0].tokens).toEqual(["hello", "hi"]);
    });

    it("fulltext parser with content", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello", "hi"]),
            expressionTokens: [],
            searchContext: new SearchContext({includeNoteContent: true})
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        expect(rootExp.subExpressions[0].constructor.name).toEqual("OrExp");
        expect(rootExp.subExpressions[1].constructor.name).toEqual("PropertyComparisonExp");

        const subs = rootExp.subExpressions[0].subExpressions;

        expect(subs[0].constructor.name).toEqual("NoteCacheFlatTextExp");
        expect(subs[0].tokens).toEqual(["hello", "hi"]);

        expect(subs[1].constructor.name).toEqual("NoteContentProtectedFulltextExp");
        expect(subs[1].tokens).toEqual(["hello", "hi"]);

        expect(subs[2].constructor.name).toEqual("NoteContentUnprotectedFulltextExp");
        expect(subs[2].tokens).toEqual(["hello", "hi"]);
    });

    it("simple label comparison", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#mylabel", "=", "text"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("LabelComparisonExp");
        expect(rootExp.attributeType).toEqual("label");
        expect(rootExp.attributeName).toEqual("mylabel");
        expect(rootExp.comparator).toBeTruthy();
    });

    it("simple attribute negation", () => {
        let rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#!mylabel"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("NotExp");
        expect(rootExp.subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpression.attributeType).toEqual("label");
        expect(rootExp.subExpression.attributeName).toEqual("mylabel");

        rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["~!myrelation"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("NotExp");
        expect(rootExp.subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpression.attributeType).toEqual("relation");
        expect(rootExp.subExpression.attributeName).toEqual("myrelation");
    });

    it("simple label AND", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "and", "#second", "=", "text"]),
            searchContext: new SearchContext(true)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label AND without explicit AND", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "#second", "=", "text"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label OR", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "or", "#second", "=", "text"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("fulltext and simple label", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello"]),
            expressionTokens: tokens(["#mylabel", "=", "text"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("AndExp");
        expect(firstSub.subExpressions[0].constructor.name).toEqual("NoteCacheFlatTextExp");
        expect(firstSub.subExpressions[0].tokens).toEqual(["hello"]);

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("mylabel");
    });

    it("label sub-expression", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "or", ["#second", "=", "text", "and", "#third", "=", "text"]]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("AndExp");
        const [firstSubSub, secondSubSub] = secondSub.subExpressions;

        expect(firstSubSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSubSub.attributeName).toEqual("second");

        expect(secondSubSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSubSub.attributeName).toEqual("third");
    });
});

describe("Invalid expressions", () => {
    it("incomplete comparison", () => {
        const searchContext = new SearchContext();

        parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "="]),
            searchContext
        });

        expect(searchContext.error).toEqual('Misplaced or incomplete expression "="')
    });

    it("comparison between labels is impossible", () => {
        let searchContext = new SearchContext();
        searchContext.originalQuery = "#first = #second";

        parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "#second"]),
            searchContext
        });

        expect(searchContext.error).toEqual(`Error near token "#second" in "#first = #second", it's possible to compare with constant only.`);

        searchContext = new SearchContext();
        searchContext.originalQuery = "#first = note.relations.second";

        parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "note", ".", "relations", "second"]),
            searchContext
        });

        expect(searchContext.error).toEqual(`Error near token "note" in "#first = note.relations.second", it's possible to compare with constant only.`);

        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: [
                { token: "#first", inQuotes: false },
                { token: "=", inQuotes: false },
                { token: "#second", inQuotes: true },
            ],
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("LabelComparisonExp");
        expect(rootExp.attributeType).toEqual("label");
        expect(rootExp.attributeName).toEqual("first");
        expect(rootExp.comparator).toBeTruthy();
    });
});
