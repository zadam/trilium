const parser = require('../src/services/search/parser');

describe("Parser", () => {
    it("fulltext parser without content", () => {
        const exps = parser(["hello", "hi"], [], false);

        expect(exps.constructor.name).toEqual("NoteCacheFulltextExp");
        expect(exps.tokens).toEqual(["hello", "hi"]);
    });
});
