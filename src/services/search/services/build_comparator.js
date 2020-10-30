const stringComparators = {
    "=": comparedValue => (val => val === comparedValue),
    "!=": comparedValue => (val => val !== comparedValue),
    ">": comparedValue => (val => val > comparedValue),
    ">=": comparedValue => (val => val >= comparedValue),
    "<": comparedValue => (val => val < comparedValue),
    "<=": comparedValue => (val => val <= comparedValue),
    "*=": comparedValue => (val => val && val.endsWith(comparedValue)),
    "=*": comparedValue => (val => val && val.startsWith(comparedValue)),
    "*=*": comparedValue => (val => val && val.includes(comparedValue)),
};

const numericComparators = {
    ">": comparedValue => (val => parseFloat(val) > comparedValue),
    ">=": comparedValue => (val => parseFloat(val) >= comparedValue),
    "<": comparedValue => (val => parseFloat(val) < comparedValue),
    "<=": comparedValue => (val => parseFloat(val) <= comparedValue)
};

function buildComparator(operator, comparedValue) {
    comparedValue = comparedValue.toLowerCase();

    if (operator in numericComparators && !isNaN(comparedValue)) {
        return numericComparators[operator](parseFloat(comparedValue));
    }

    if (operator in stringComparators) {
        return stringComparators[operator](comparedValue);
    }
}

module.exports = buildComparator;
