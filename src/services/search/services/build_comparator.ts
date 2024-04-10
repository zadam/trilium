const cachedRegexes: Record<string, RegExp> = {};

function getRegex(str: string) {
    if (!(str in cachedRegexes)) {
        cachedRegexes[str] = new RegExp(str);
    }

    return cachedRegexes[str];
}

type Comparator<T> = (comparedValue: T) => ((val: string) => boolean);

const stringComparators: Record<string, Comparator<string>> = {
    "=": comparedValue => (val => val === comparedValue),
    "!=": comparedValue => (val => val !== comparedValue),
    ">": comparedValue => (val => val > comparedValue),
    ">=": comparedValue => (val => val >= comparedValue),
    "<": comparedValue => (val => val < comparedValue),
    "<=": comparedValue => (val => val <= comparedValue),
    "*=": comparedValue => (val => !!val && val.endsWith(comparedValue)),
    "=*": comparedValue => (val => !!val && val.startsWith(comparedValue)),
    "*=*": comparedValue => (val => !!val && val.includes(comparedValue)),
    "%=": comparedValue => (val => !!val && !!getRegex(comparedValue).test(val)),
};

const numericComparators: Record<string, Comparator<number>> = {
    ">": comparedValue => (val => parseFloat(val) > comparedValue),
    ">=": comparedValue => (val => parseFloat(val) >= comparedValue),
    "<": comparedValue => (val => parseFloat(val) < comparedValue),
    "<=": comparedValue => (val => parseFloat(val) <= comparedValue)
};

function buildComparator(operator: string, comparedValue: string) {
    comparedValue = comparedValue.toLowerCase();

    if (operator in numericComparators) {
        const floatValue = parseFloat(comparedValue);
        if (!isNaN(floatValue)) {
            return numericComparators[operator](floatValue);
        }
    }

    if (operator in stringComparators) {
        return stringComparators[operator](comparedValue);
    }
}

export = buildComparator;
