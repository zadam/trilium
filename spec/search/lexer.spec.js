const lex = require('../../src/services/search/services/lex.js');

describe("Lexer fulltext", () => {
    it("simple lexing", () => {
        expect(lex("hello world").fulltextTokens.map(t => t.token))
            .toEqual(["hello", "world"]);
    });

    it("use quotes to keep words together", () => {
        expect(lex("'hello world' my friend").fulltextTokens.map(t => t.token))
            .toEqual(["hello world", "my", "friend"]);

        expect(lex('"hello world" my friend').fulltextTokens.map(t => t.token))
            .toEqual(["hello world", "my", "friend"]);

        expect(lex('`hello world` my friend').fulltextTokens.map(t => t.token))
            .toEqual(["hello world", "my", "friend"]);
    });

    it("you can use different quotes and other special characters inside quotes", () => {
        expect(lex("'i can use \" or ` or #~=*' without problem").fulltextTokens.map(t => t.token))
            .toEqual(["i can use \" or ` or #~=*", "without", "problem"]);
    });

    it("if quote is not ended then it's just one long token", () => {
        expect(lex("'unfinished quote").fulltextTokens.map(t => t.token))
            .toEqual(["unfinished quote"]);
    });

    it("parenthesis and symbols in fulltext section are just normal characters", () => {
        expect(lex("what's u=p <b(r*t)h>").fulltextTokens.map(t => t.token))
            .toEqual(["what's", "u=p", "<b(r*t)h>"]);
    });

    it("escaping special characters", () => {
        expect(lex("hello \\#\\~\\'").fulltextTokens.map(t => t.token))
            .toEqual(["hello", "#~'"]);
    });
});

describe("Lexer expression", () => {
    it("simple attribute existence", () => {
        expect(lex("#label ~relation").expressionTokens.map(t => t.token))
            .toEqual(["#label", "~relation"]);
    });

    it("simple label operators", () => {
        expect(lex("#label*=*text").expressionTokens.map(t => t.token))
            .toEqual(["#label", "*=*", "text"]);
    });

    it("simple label operator with in quotes and without", () => {
        expect(lex("#label*=*'text'").expressionTokens)
            .toEqual([
                {token: "#label", inQuotes: false},
                {token: "*=*", inQuotes: false},
                {token: "text", inQuotes: true}
            ]);

        expect(lex("#label*=*text").expressionTokens)
            .toEqual([
                {token: "#label", inQuotes: false},
                {token: "*=*", inQuotes: false},
                {token: "text", inQuotes: false}
            ]);
    });

    it("complex expressions with and, or and parenthesis", () => {
        expect(lex(`# (#label=text OR #second=text) AND ~relation`).expressionTokens.map(t => t.token))
            .toEqual(["#", "(", "#label", "=", "text", "or", "#second", "=", "text", ")", "and", "~relation"]);
    });

    it("dot separated properties", () => {
        expect(lex(`# ~author.title = 'Hugh Howey' AND note.'book title' = 'Silo'`).expressionTokens.map(t => t.token))
            .toEqual(["#", "~author", ".", "title", "=", "hugh howey", "and", "note", ".", "book title", "=", "silo"]);
    });

    it("negation of label and relation", () => {
        expect(lex(`#!capital ~!neighbor`).expressionTokens.map(t => t.token))
            .toEqual(["#!capital", "~!neighbor"]);
    });

    it("negation of sub-expression", () => {
        expect(lex(`# not(#capital) and note.noteId != "root"`).expressionTokens.map(t => t.token))
            .toEqual(["#", "not", "(", "#capital", ")", "and", "note", ".", "noteid", "!=", "root"]);
    });
});

describe("Lexer invalid queries and edge cases", () => {
    it("concatenated attributes", () => {
        expect(lex("#label~relation").expressionTokens.map(t => t.token))
            .toEqual(["#label", "~relation"]);
    });

    it("spaces in attribute names and values", () => {
        // invalid but should be reported by parser as an error
        expect(lex(`#'long label'="hello o' world" ~'long relation'`).expressionTokens.map(t => t.token))
            .toEqual(["#long label", "=", "hello o' world", "~long relation"]);
    });
});
