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
        },
        toBeTruthy: () => {
            if (!val) {
                console.trace("toBeTruthy failed.");
                console.error(`expected: truthy value`);
                console.error(`got:      ${val}`);

                errorCount++;
            }
        },
        toBeFalsy: () => {
            if (!!val) {
                console.trace("toBeFalsy failed.");
                console.error(`expected: null, false, undefined, 0 or empty string`);
                console.error(`got:      ${val}`);

                errorCount++;
            }
        },
        toThrow: errorMessage => {
            try {
                val();
            }
            catch (e) {
                if (e.message !== errorMessage) {
                    console.trace("toThrow caught exception, but messages differ");
                    console.error(`expected: ${errorMessage}`);
                    console.error(`got:      ${e.message}`);
                    console.error(`${e.stack}`);

                    errorCount++;
                }

                return;
            }

            console.trace("toThrow did not catch any exception.");
            console.error(`expected: ${errorMessage}`);
            console.error(`got:      [none]`);
            errorCount++;
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
