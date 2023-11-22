const SearchContext = require('../../src/services/search/search_context.js');
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

function assertIsArchived(exp) {
    expect(exp.constructor.name).toEqual("PropertyComparisonExp");
    expect(exp.propertyName).toEqual("isArchived");
    expect(exp.operator).toEqual("=");
    expect(exp.comparedValue).toEqual("false");
}

describe("Parser", () => {
    it("fulltext parser without content", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello", "hi"]),
            expressionTokens: [],
            searchContext: new SearchContext({excludeArchived: true})
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        expect(rootExp.subExpressions[0].constructor.name).toEqual("PropertyComparisonExp");
        expect(rootExp.subExpressions[2].constructor.name).toEqual("OrExp");
        expect(rootExp.subExpressions[2].subExpressions[0].constructor.name).toEqual("NoteFlatTextExp");
        expect(rootExp.subExpressions[2].subExpressions[0].tokens).toEqual(["hello", "hi"]);
    });

    it("fulltext parser with content", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello", "hi"]),
            expressionTokens: [],
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("OrExp");

        const subs = rootExp.subExpressions[2].subExpressions;

        expect(subs[0].constructor.name).toEqual("NoteFlatTextExp");
        expect(subs[0].tokens).toEqual(["hello", "hi"]);

        expect(subs[1].constructor.name).toEqual("NoteContentFulltextExp");
        expect(subs[1].tokens).toEqual(["hello", "hi"]);
    });

    it("simple label comparison", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#mylabel", "=", "text"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);
        expect(rootExp.subExpressions[2].constructor.name).toEqual("LabelComparisonExp");
        expect(rootExp.subExpressions[2].attributeType).toEqual("label");
        expect(rootExp.subExpressions[2].attributeName).toEqual("mylabel");
        expect(rootExp.subExpressions[2].comparator).toBeTruthy();
    });

    it("simple attribute negation", () => {
        let rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#!mylabel"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);
        expect(rootExp.subExpressions[2].constructor.name).toEqual("NotExp");
        expect(rootExp.subExpressions[2].subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpressions[2].subExpression.attributeType).toEqual("label");
        expect(rootExp.subExpressions[2].subExpression.attributeName).toEqual("mylabel");

        rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["~!myrelation"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);
        expect(rootExp.subExpressions[2].constructor.name).toEqual("NotExp");
        expect(rootExp.subExpressions[2].subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpressions[2].subExpression.attributeType).toEqual("relation");
        expect(rootExp.subExpressions[2].subExpression.attributeName).toEqual("myrelation");
    });

    it("simple label AND", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "and", "#second", "=", "text"]),
            searchContext: new SearchContext(true)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions[2].subExpressions;

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
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions[2].subExpressions;

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

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions[2].subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("fulltext and simple label", () => {
        const rootExp = parse({
            fulltextTokens: tokens(["hello"]),
            expressionTokens: tokens(["#mylabel", "=", "text"]),
            searchContext: new SearchContext({excludeArchived: true})
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub, thirdSub, fourth] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("PropertyComparisonExp");
        expect(firstSub.propertyName).toEqual('isArchived');

        expect(thirdSub.constructor.name).toEqual("OrExp");
        expect(thirdSub.subExpressions[0].constructor.name).toEqual("NoteFlatTextExp");
        expect(thirdSub.subExpressions[0].tokens).toEqual(["hello"]);

        expect(fourth.constructor.name).toEqual("LabelComparisonExp");
        expect(fourth.attributeName).toEqual("mylabel");
    });

    it("label sub-expression", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", "=", "text", "or", ["#second", "=", "text", "and", "#third", "=", "text"]]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions[2].subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("AndExp");
        const [firstSubSub, secondSubSub] = secondSub.subExpressions;

        expect(firstSubSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSubSub.attributeName).toEqual("second");

        expect(secondSubSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSubSub.attributeName).toEqual("third");
    });

    it("label sub-expression without explicit operator", () => {
        const rootExp = parse({
            fulltextTokens: [],
            expressionTokens: tokens(["#first", ["#second", "or", "#third"], "#fourth"]),
            searchContext: new SearchContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("AndExp");
        const [firstSub, secondSub, thirdSub] = rootExp.subExpressions[2].subExpressions;

        expect(firstSub.constructor.name).toEqual("AttributeExistsExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("OrExp");
        const [firstSubSub, secondSubSub] = secondSub.subExpressions;

        expect(firstSubSub.constructor.name).toEqual("AttributeExistsExp");
        expect(firstSubSub.attributeName).toEqual("second");

        expect(secondSubSub.constructor.name).toEqual("AttributeExistsExp");
        expect(secondSubSub.attributeName).toEqual("third");

        expect(thirdSub.constructor.name).toEqual("AttributeExistsExp");
        expect(thirdSub.attributeName).toEqual("fourth");
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

        expect(rootExp.constructor.name).toEqual("AndExp");
        assertIsArchived(rootExp.subExpressions[0]);

        expect(rootExp.subExpressions[2].constructor.name).toEqual("LabelComparisonExp");
        expect(rootExp.subExpressions[2].attributeType).toEqual("label");
        expect(rootExp.subExpressions[2].attributeName).toEqual("first");
        expect(rootExp.subExpressions[2].comparator).toBeTruthy();
    });

    it("searching by relation without note property", () => {
        const searchContext = new SearchContext();

        parse({
            fulltextTokens: [],
            expressionTokens: tokens(["~first", "=", "text", "-", "abc"]),
            searchContext
        });

        expect(searchContext.error).toEqual('Relation can be compared only with property, e.g. ~relation.title=hello in ""')
    });
});
