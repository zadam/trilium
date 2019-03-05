const dayjs = require("dayjs");

const labelRegex = /(\b(and|or)\s+)?@(!?)([\w_-]+|"[^"]+")((=|!=|<|<=|>|>=)([\w_-]+|"[^"]+"))?/i;
const smartValueRegex = /^(TODAY|NOW)(([+\-])(\d+)([HDMY])){0,1}$/i;

function calculateSmartValue(v) {
    const normalizedV = v.toUpperCase() + "+0D"; // defaults of sorts
    const [ , keyword, sign, snum, unit] = /(TODAY|NOW)([+\-])(\d+)([HDMY])/.exec(normalizedV);
    const num = parseInt(snum);

    if (keyword !== "TODAY" && keyword !== "NOW") {
        return v;
    }

    const fullUnit = {
        TODAY: { D: "days", M: "months", Y: "years" },
        NOW: { D: "days", M: "minutes", H: "hours" }
    }[keyword][unit];

    const format = keyword === "TODAY" ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm";
    const date = (sign === "+" ? dayjs().add(num, fullUnit) : dayjs().subtract(num, fullUnit));

    return date.format(format);
}

module.exports = function(searchText) {
    const labelFilters = [];
    let match = labelRegex.exec(searchText);

    function trimQuotes(str) { return str.startsWith('"') ? str.substr(1, str.length - 2) : str; }

    while (match != null) {
        const relation = match[2] !== undefined ? match[2].toLowerCase() : 'and';
        const operator = match[3] === '!' ? 'not-exists' : 'exists';

        const value = match[7] !== undefined ? trimQuotes(match[7]) : null;

        labelFilters.push({
            relation: relation,
            name: trimQuotes(match[4]),
            operator: match[6] !== undefined ? match[6] : operator,
            value: (
                value && value.match(smartValueRegex)
                    ? calculateSmartValue(value)
                    : value
            )
        });

        // remove labels from further fulltext search
        searchText = searchText.split(match[0]).join('');

        match = labelRegex.exec(searchText);
    }

    return { labelFilters: labelFilters, searchText };
};
