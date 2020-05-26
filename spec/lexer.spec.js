const lexer = require('../src/services/search/lexer');

describe("Lexer fulltext", () => {
    it("simple lexing", () => {
        expect(lexer("hello world").fulltextTokens)
            .toEqual(["hello", "world"]);
    });

    it("use quotes to keep words together", () => {
        expect(lexer("'hello world' my friend").fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);

        expect(lexer('"hello world" my friend').fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);

        expect(lexer('`hello world` my friend').fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);
    });

    it("you can use different quotes and other special characters inside quotes", () => {
        expect(lexer("'i can use \" or ` or #~=*' without problem").fulltextTokens)
            .toEqual(["i can use \" or ` or #~=*", "without", "problem"]);
    });

    it("if quote is not ended then it's just one long token", () => {
        expect(lexer("'unfinished quote").fulltextTokens)
            .toEqual(["unfinished quote"]);
    });

    it("parenthesis and symbols in fulltext section are just normal characters", () => {
        expect(lexer("what's u=p <b(r*t)h>").fulltextTokens)
            .toEqual(["what's", "u=p", "<b(r*t)h>"]);
    });

    it("escaping special characters", () => {
        expect(lexer("hello \\#\\~\\'").fulltextTokens)
            .toEqual(["hello", "#~'"]);
    });
});

describe("Lexer expression", () => {
    it("simple attribute existence", () => {
        expect(lexer("#label ~relation").expressionTokens)
            .toEqual(["#label", "~relation"]);
    });

    it("simple label operators", () => {
        expect(lexer("#label*=*text").expressionTokens)
            .toEqual(["#label", "*=*", "text"]);
    });

    it("spaces in attribute names and values", () => {
        expect(lexer(`#'long label'="hello o' world" ~'long relation'`).expressionTokens)
            .toEqual(["#long label", "=", "hello o' world", "~long relation"]);
    });

    it("complex expressions with and, or and parenthesis", () => {
        expect(lexer(`# (#label=text OR #second=text) AND ~relation`).expressionTokens)
            .toEqual(["#", "(", "#label", "=", "text", "or", "#second", "=", "text", ")", "and", "~relation"]);
    });

    it("dot separated properties", () => {
        expect(lexer(`# ~author.title = 'Hugh Howey' AND note.'book title' = 'Silo'`).expressionTokens)
            .toEqual(["#", "~author", ".", "title", "=", "hugh howey", "and", "note", ".", "book title", "=", "silo"]);
    });

    it("negation of sub-expression", () => {
        expect(lexer(`# not(#capital) and note.noteId != "root"`).expressionTokens)
            .toEqual(["#", "not", "(", "#capital", ")", "and", "note", ".", "noteid", "!=", "root"]);
    });
});
