export function describe(name, cb) {
    console.log(`Running ${name}`);

    cb();
}

export async function it(name, cb) {
    console.log(`      Running ${name}`);

    cb();
}

let errorCount = 0;

export function expect(val) {
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

export function execute() {
    console.log("");

    if (errorCount) {
        console.log(`!!!${errorCount} tests failed!!!`);
    }
    else {
        console.log("All tests passed!");
    }
}
