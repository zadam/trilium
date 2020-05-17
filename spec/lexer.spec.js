const lexerSpec = require('../src/services/search/lexer.js');

describe("Lexer", function() {
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
});
