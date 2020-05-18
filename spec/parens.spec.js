const parens = require('../src/services/search/parens');

describe("Parens handler", () => {
    it("handles parens", () => {console.log(parens(["(", "hello", ")", "and", "(", "(", "pick", "one", ")", "and", "another", ")"]))
        expect(parens(["(", "hello", ")", "and", "(", "(", "pick", "one", ")", "and", "another", ")"]))
            .toEqual([
                [
                    "hello"
                ],
                "and",
                [
                    [
                        "pick",
                        "one"
                    ],
                    "and",
                    "another"
                ]
            ]);
    });
});
