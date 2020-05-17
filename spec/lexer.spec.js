const lexerSpec = require('../src/services/search/lexer');

describe("Lexer fulltext", () => {
    it("simple lexing", () => {
        expect(lexerSpec("hello world").fulltextTokens)
            .toEqual(["hello", "world"]);
    });

    it("use quotes to keep words together", () => {
        expect(lexerSpec("'hello world' my friend").fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);

        expect(lexerSpec('"hello world" my friend').fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);

        expect(lexerSpec('`hello world` my friend').fulltextTokens)
            .toEqual(["hello world", "my", "friend"]);
    });

    it("you can use different quotes and other special characters inside quotes", () => {
        expect(lexerSpec("'I can use \" or ` or #@=*' without problem").fulltextTokens)
            .toEqual(["I can use \" or ` or #@=*", "without", "problem"]);
    });

    it("if quote is not ended then it's just one long token", () => {
        expect(lexerSpec("'unfinished quote").fulltextTokens)
            .toEqual(["unfinished quote"]);
    });

    it("parenthesis and symbols in fulltext section are just normal characters", () => {
        expect(lexerSpec("what's u=p <b(r*t)h>").fulltextTokens)
            .toEqual(["what's", "u=p", "<b(r*t)h>"]);
    });

    it("escaping special characters", () => {
        expect(lexerSpec("hello \\#\\@\\'").fulltextTokens)
            .toEqual(["hello", "#@'"]);
    });
});

describe("Lexer expression", () => {
    it("simple attribute existence", () => {
        expect(lexerSpec("#label @relation").expressionTokens)
            .toEqual(["#label", "@relation"]);
    });

    it("simple label operators", () => {
        expect(lexerSpec("#label*=*text").expressionTokens)
            .toEqual(["#label", "*=*", "text"]);
    });

    it("spaces in attribute names and values", () => {
        expect(lexerSpec(`#'long label'="hello o' world" @'long relation'`).expressionTokens)
            .toEqual(["#long label", "=", "hello o' world", "@long relation"]);
    });

    it("complex expressions with and, or and parenthesis", () => {
        expect(lexerSpec(`# (#label=text OR #second=text) AND @relation`).expressionTokens)
            .toEqual(["#", "(", "#label", "=", "text", "OR", "#second", "=", "text", ")", "AND", "@relation"]);
    });
});
