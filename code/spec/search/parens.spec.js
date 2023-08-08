const handleParens = require('../../src/services/search/services/handle_parens');

describe("Parens handler", () => {
    it("handles parens", () => {
        const input = ["(", "hello", ")", "and", "(", "(", "pick", "one", ")", "and", "another", ")"]
            .map(token => ({token}));

        expect(handleParens(input))
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
