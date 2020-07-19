const parens = require('../../src/services/search/parens.js');

describe("Parens handler", () => {
    it("handles parens", () => {
        const input = ["(", "hello", ")", "and", "(", "(", "pick", "one", ")", "and", "another", ")"]
            .map(token => ({token}));

        expect(parens(input))
            .toEqual([
                [
                    {token: "hello"}
                ],
                {token: "and"},
                [
                    [
                        {token: "pick"},
                        {token: "one"}
                    ],
                    {token: "and"},
                    {token: "another"}
                ]
            ]);
    });
});
