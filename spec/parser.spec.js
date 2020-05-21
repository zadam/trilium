const ParsingContext = require("../src/services/search/parsing_context");
const parser = require('../src/services/search/parser');

describe("Parser", () => {
    it("fulltext parser without content", () => {
        const rootExp = parser({
            fulltextTokens: ["hello", "hi"],
            expressionTokens: [],
            parsingContext: new ParsingContext(false)
        });

        expect(rootExp.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(rootExp.tokens).toEqual(["hello", "hi"]);
    });

    it("fulltext parser with content", () => {
        const rootExp = parser({
            fulltextTokens: ["hello", "hi"],
            expressionTokens: [],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(firstSub.tokens).toEqual(["hello", "hi"]);

        expect(secondSub.constructor.name).toEqual("NoteContentFulltextExp");
        expect(secondSub.tokens).toEqual(["hello", "hi"]);
    });

    it("simple label comparison", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#mylabel", "=", "text"],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("FieldComparisonExp");
        expect(rootExp.attributeType).toEqual("label");
        expect(rootExp.attributeName).toEqual("mylabel");
        expect(rootExp.comparator).toBeTruthy();
    });

    it("simple label AND", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "AND", "#second", "=", "text"],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("FieldComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("FieldComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label AND without explicit AND", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "#second", "=", "text"],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("FieldComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("FieldComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label OR", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "OR", "#second", "=", "text"],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("FieldComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("FieldComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("fulltext and simple label", () => {
        const rootExp = parser({
            fulltextTokens: ["hello"],
            expressionTokens: ["#mylabel", "=", "text"],
            parsingContext: new ParsingContext(false)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(firstSub.tokens).toEqual(["hello"]);

        expect(secondSub.constructor.name).toEqual("FieldComparisonExp");
        expect(secondSub.attributeName).toEqual("mylabel");
    });

    it("label sub-expression", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "OR", ["#second", "=", "text", "AND", "#third", "=", "text"]],
            parsingContext: new ParsingContext(false)
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("FieldComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("AndExp");
        const [firstSubSub, secondSubSub] = secondSub.subExpressions;

        expect(firstSubSub.constructor.name).toEqual("FieldComparisonExp");
        expect(firstSubSub.attributeName).toEqual("second");

        expect(secondSubSub.constructor.name).toEqual("FieldComparisonExp");
        expect(secondSubSub.attributeName).toEqual("third");
    });
});
