const ParsingContext = require("../../src/services/search/parsing_context.js");
const parser = require('../../src/services/search/parser.js');

describe("Parser", () => {
    it("fulltext parser without content", () => {
        const rootExp = parser({
            fulltextTokens: ["hello", "hi"],
            expressionTokens: [],
            parsingContext: new ParsingContext({includeNoteContent: false})
        });

        expect(rootExp.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(rootExp.tokens).toEqual(["hello", "hi"]);
    });

    it("fulltext parser with content", () => {
        const rootExp = parser({
            fulltextTokens: ["hello", "hi"],
            expressionTokens: [],
            parsingContext: new ParsingContext({includeNoteContent: true})
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const subs = rootExp.subExpressions;

        expect(subs[0].constructor.name).toEqual("NoteCacheFulltextExp");
        expect(subs[0].tokens).toEqual(["hello", "hi"]);

        expect(subs[1].constructor.name).toEqual("NoteContentProtectedFulltextExp");
        expect(subs[1].tokens).toEqual(["hello", "hi"]);

        expect(subs[2].constructor.name).toEqual("NoteContentUnprotectedFulltextExp");
        expect(subs[2].tokens).toEqual(["hello", "hi"]);
    });

    it("simple label comparison", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#mylabel", "=", "text"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("LabelComparisonExp");
        expect(rootExp.attributeType).toEqual("label");
        expect(rootExp.attributeName).toEqual("mylabel");
        expect(rootExp.comparator).toBeTruthy();
    });

    it("simple attribute negation", () => {
        let rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#!mylabel"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("NotExp");
        expect(rootExp.subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpression.attributeType).toEqual("label");
        expect(rootExp.subExpression.attributeName).toEqual("mylabel");

        rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["~!myrelation"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("NotExp");
        expect(rootExp.subExpression.constructor.name).toEqual("AttributeExistsExp");
        expect(rootExp.subExpression.attributeType).toEqual("relation");
        expect(rootExp.subExpression.attributeName).toEqual("myrelation");
    });

    it("simple label AND", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "and", "#second", "=", "text"],
            parsingContext: new ParsingContext(true)
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label AND without explicit AND", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "#second", "=", "text"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("simple label OR", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "or", "#second", "=", "text"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("OrExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("LabelComparisonExp");
        expect(firstSub.attributeName).toEqual("first");

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("second");
    });

    it("fulltext and simple label", () => {
        const rootExp = parser({
            fulltextTokens: ["hello"],
            expressionTokens: ["#mylabel", "=", "text"],
            parsingContext: new ParsingContext()
        });

        expect(rootExp.constructor.name).toEqual("AndExp");
        const [firstSub, secondSub] = rootExp.subExpressions;

        expect(firstSub.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(firstSub.tokens).toEqual(["hello"]);

        expect(secondSub.constructor.name).toEqual("LabelComparisonExp");
        expect(secondSub.attributeName).toEqual("mylabel");
    });

    it("label sub-expression", () => {
        const rootExp = parser({
            fulltextTokens: [],
            expressionTokens: ["#first", "=", "text", "or", ["#second", "=", "text", "and", "#third", "=", "text"]],
            parsingContext: new ParsingContext()
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
