import attributeParser from '../src/public/app/services/attribute_parser.mjs';

function describe(name, cb) {
    console.log(`Running ${name}`);

    cb();
}

function it(name, cb) {
    console.log(`      Running ${name}`);

    cb();
}

let errorCount = 0;

function expect(val) {
    return {
        toEqual: comparedVal => {
            const jsonVal = JSON.stringify(val);
            const comparedJsonVal = JSON.stringify(comparedVal);

            if (jsonVal !== comparedJsonVal) {
                console.trace("toEqual check failed.");
                console.error(`expected: ${comparedJsonVal}`);
                console.error(`got:      ${jsonVal}`);

                errorCount++;
            }
        }
    }
}

describe("Lexer fulltext", () => {
    it("simple label", () => {
        expect(attributeParser.lexer("#label")).toEqual(["#labe"]);
    });
});

console.log("");

if (errorCount) {
    console.log(`!!!${errorCount} tests failed!!!`);
}
else {
    console.log("All tests passed!");
}
