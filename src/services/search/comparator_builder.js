const dayjs = require("dayjs");

const stringComparators = {
    "=": comparedValue => (val => val === comparedValue),
    "!=": comparedValue => (val => val !== comparedValue),
    ">": comparedValue => (val => val > comparedValue),
    ">=": comparedValue => (val => val >= comparedValue),
    "<": comparedValue => (val => val < comparedValue),
    "<=": comparedValue => (val => val <= comparedValue),
    "*=": comparedValue => (val => val.endsWith(comparedValue)),
    "=*": comparedValue => (val => val.startsWith(comparedValue)),
    "*=*": comparedValue => (val => val.includes(comparedValue)),
};

const numericComparators = {
    ">": comparedValue => (val => parseFloat(val) > comparedValue),
    ">=": comparedValue => (val => parseFloat(val) >= comparedValue),
    "<": comparedValue => (val => parseFloat(val) < comparedValue),
    "<=": comparedValue => (val => parseFloat(val) <= comparedValue)
};

const smartValueRegex = /^(NOW|TODAY|WEEK|MONTH|YEAR) *([+\-] *\d+)?$/i;

function calculateSmartValue(v) {
    const match = smartValueRegex.exec(v);
    if (match === null) {
        return v;
    }

    const keyword = match[1].toUpperCase();
    const num = match[2] ? parseInt(match[2].replace(/ /g, "")) : 0; // can contain spaces between sign and digits

    let format, date;

    if (keyword === 'NOW') {
        date = dayjs().add(num, 'second');
        format = "YYYY-MM-DD HH:mm:ss";
    }
    else if (keyword === 'TODAY') {
        date = dayjs().add(num, 'day');
        format = "YYYY-MM-DD";
    }
    else if (keyword === 'WEEK') {
        // FIXME: this will always use sunday as start of the week
        date = dayjs().startOf('week').add(7 * num, 'day');
        format = "YYYY-MM-DD";
    }
    else if (keyword === 'MONTH') {
        date = dayjs().add(num, 'month');
        format = "YYYY-MM";
    }
    else if (keyword === 'YEAR') {
        date = dayjs().add(num, 'year');
        format = "YYYY";
    }
    else {
        throw new Error("Unrecognized keyword: " + keyword);
    }

    return date.format(format);
}

function buildComparator(operator, comparedValue) {
    comparedValue = comparedValue.toLowerCase();

    comparedValue = calculateSmartValue(comparedValue);

    if (operator in numericComparators && !isNaN(comparedValue)) {
        return numericComparators[operator](parseFloat(comparedValue));
    }

    if (operator in stringComparators) {
        return stringComparators[operator](comparedValue);
    }
}

module.exports = buildComparator;
